import { after } from "next/server"
import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { categorizeRepos } from "@/lib/ai-categorize"
import { getAIModel, getProviderOptions, type AIModelConfig } from "@/lib/ai-provider"
import { langfuseSpanProcessor } from "@/instrumentation"
import {
  assignCollection,
  assignTag,
  ensureCollections,
  ensureTags,
  listCollections,
  listTags,
  normalizeCollectionName,
  normalizeTagLabel,
} from "@/lib/user-metadata"
import type { CategorizationResult } from "@/lib/types"

export const maxDuration = 120

const AI_CATEGORIZATION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

interface UserRepoRow {
  id: string
  starred_at: string | null
  created_at: string
  github_repo_id: number
}

interface CategorizationSlotReservation {
  allowed: boolean
  claimedAt: string | null
  previousLastCategorizedAt: string | null
  nextAllowedAt: string | null
}

function formatCooldownMessage(nextAllowedAt: string) {
  const nextAllowedLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(nextAllowedAt))

  return `AI categorization is limited to once per week. Try again after ${nextAllowedLabel} UTC.`
}

function reserveCategorizationSlot(userId: string): CategorizationSlotReservation {
  const profile = db
    .prepare("select last_ai_categorization_at from profiles where id = ?")
    .get(userId) as { last_ai_categorization_at: string | null } | undefined

  const previousLastCategorizedAt = profile?.last_ai_categorization_at ?? null
  const now = Date.now()

  if (previousLastCategorizedAt) {
    const nextAllowedAt = new Date(
      new Date(previousLastCategorizedAt).getTime() + AI_CATEGORIZATION_COOLDOWN_MS,
    ).toISOString()

    if (new Date(nextAllowedAt).getTime() > now) {
      return { allowed: false, claimedAt: null, previousLastCategorizedAt, nextAllowedAt }
    }
  }

  const claimedAt = new Date(now).toISOString()
  // Single-process SQLite: no concurrent-claim race to guard against.
  db.prepare(
    `insert into profiles (id, last_ai_categorization_at) values (?, ?)
     on conflict (id) do update set last_ai_categorization_at = excluded.last_ai_categorization_at`,
  ).run(userId, claimedAt)

  return {
    allowed: true,
    claimedAt,
    previousLastCategorizedAt,
    nextAllowedAt: new Date(now + AI_CATEGORIZATION_COOLDOWN_MS).toISOString(),
  }
}

function releaseCategorizationSlot(
  userId: string,
  claimedAt: string,
  previousLastCategorizedAt: string | null,
) {
  try {
    db.prepare(
      "update profiles set last_ai_categorization_at = ? where id = ? and last_ai_categorization_at = ?",
    ).run(previousLastCategorizedAt, userId, claimedAt)
  } catch (error) {
    console.error("Failed to release AI categorization slot:", error)
  }
}

function rowTimestampMs(row: UserRepoRow): number | null {
  const starredAtMs = row.starred_at ? new Date(row.starred_at).getTime() : NaN
  if (Number.isFinite(starredAtMs)) return starredAtMs

  const createdAtMs = new Date(row.created_at).getTime()
  return Number.isFinite(createdAtMs) ? createdAtMs : null
}

function repoWasStarredAfterLastCategorization(
  row: UserRepoRow,
  previousLastCategorizedAt: string | null,
) {
  if (!previousLastCategorizedAt) return true

  const repoTimestampMs = rowTimestampMs(row)
  if (repoTimestampMs === null) return false

  return repoTimestampMs > new Date(previousLastCategorizedAt).getTime()
}

export async function POST(request: Request) {
  let slotReservation: CategorizationSlotReservation | null = null
  let userIdForRelease: string | null = null
  let modelConfig: AIModelConfig | null = null

  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    modelConfig = getAIModel(request)

    if (!modelConfig.isUserKey) {
      userIdForRelease = user.id
      slotReservation = reserveCategorizationSlot(user.id)

      if (!slotReservation.allowed) {
        return NextResponse.json(
          {
            error: formatCooldownMessage(slotReservation.nextAllowedAt!),
            nextAllowedAt: slotReservation.nextAllowedAt,
          },
          { status: 429 },
        )
      }
    }

    const { repos } = await request.json()

    if (!repos?.length) {
      return NextResponse.json({ error: "No repos provided" }, { status: 400 })
    }

    if (repos.length > 5000) {
      return NextResponse.json({ error: "Too many repos — maximum 5000" }, { status: 400 })
    }

    const userRepoRows = db
      .prepare(
        `select usr.id, usr.starred_at, usr.created_at, r.github_repo_id
         from user_starred_repos usr join repos r on r.id = usr.repo_id
         where usr.user_id = ?`,
      )
      .all(user.id) as unknown as UserRepoRow[]

    const repoIdMap = new Map<number, string>()
    const reposToCategorizeIdSet = new Set<number>()
    for (const row of userRepoRows) {
      repoIdMap.set(row.github_repo_id, row.id)
      if (
        repoWasStarredAfterLastCategorization(
          row,
          slotReservation?.previousLastCategorizedAt ?? null,
        )
      ) {
        reposToCategorizeIdSet.add(row.github_repo_id)
      }
    }

    const reposToCategorize = repos.filter((repo: { id: string }) =>
      reposToCategorizeIdSet.has(Number(repo.id)),
    )

    const existingTags = listTags(user.id)
    const existingCollections = listCollections(user.id)

    if (reposToCategorize.length === 0) {
      if (slotReservation?.claimedAt) {
        releaseCategorizationSlot(
          user.id,
          slotReservation.claimedAt,
          slotReservation.previousLastCategorizedAt,
        )
        slotReservation = null
      }

      return NextResponse.json({
        collections: existingCollections,
        allTags: existingTags,
        repoTags: {},
        repoCollections: {},
        generatedAt: new Date().toISOString(),
        categorizedRepoCount: 0,
      })
    }

    const result = await categorizeRepos(reposToCategorize, modelConfig.model, {
      providerOptions: getProviderOptions(modelConfig.provider),
      // Reuse the existing taxonomy when both tags and collections exist (categorizeRepos checks); otherwise generate both.
      existingTaxonomy: { collections: existingCollections, tags: existingTags },
    })

    const persistedTags = ensureTags(user.id, result.allTags)
    const persistedCollections = ensureCollections(user.id, result.collections)

    const tagByLabel = new Map(persistedTags.map((tag) => [normalizeTagLabel(tag.label), tag]))
    const collectionByName = new Map(
      persistedCollections.map((collection) => [
        normalizeCollectionName(collection.name),
        collection,
      ]),
    )

    const persistedRepoTags: CategorizationResult["repoTags"] = {}
    const persistedRepoCollections: CategorizationResult["repoCollections"] = {}
    const collectionRepoCounts = new Map<string, number>()

    db.exec("begin")
    try {
      for (const [repoId, tags] of Object.entries(result.repoTags)) {
        const userStarredRepoId = repoIdMap.get(Number(repoId))
        if (!userStarredRepoId) continue

        const persistedRepoTagList = tags
          .map((tag) => tagByLabel.get(normalizeTagLabel(tag.label)))
          .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))

        if (persistedRepoTagList.length > 0) {
          persistedRepoTags[repoId] = persistedRepoTagList
          for (const tag of persistedRepoTagList) assignTag(userStarredRepoId, user.id, tag.id)
        }
      }

      for (const [repoId, collectionIds] of Object.entries(result.repoCollections)) {
        const userStarredRepoId = repoIdMap.get(Number(repoId))
        if (!userStarredRepoId) continue

        const persistedCollectionIds = collectionIds
          .map((collectionId) => {
            const original = result.collections.find((collection) => collection.id === collectionId)
            if (!original) return null
            return collectionByName.get(normalizeCollectionName(original.name)) ?? null
          })
          .filter((collection): collection is NonNullable<typeof collection> => Boolean(collection))

        if (persistedCollectionIds.length > 0) {
          persistedRepoCollections[repoId] = persistedCollectionIds.map(
            (collection) => collection.id,
          )
          for (const collection of persistedCollectionIds) {
            collectionRepoCounts.set(
              collection.id,
              (collectionRepoCounts.get(collection.id) ?? 0) + 1,
            )
            assignCollection(userStarredRepoId, user.id, collection.id)
          }
        }
      }
      db.exec("commit")
    } catch (e) {
      db.exec("rollback")
      throw e
    }

    const persistedResult: CategorizationResult = {
      collections: persistedCollections.map((collection) => ({
        ...collection,
        repoCount: collectionRepoCounts.get(collection.id) ?? 0,
      })),
      allTags: persistedTags,
      repoTags: persistedRepoTags,
      repoCollections: persistedRepoCollections,
      generatedAt: result.generatedAt,
      categorizedRepoCount: reposToCategorize.length,
    }

    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })
    return NextResponse.json(persistedResult)
  } catch (err) {
    if (slotReservation?.allowed && slotReservation.claimedAt && userIdForRelease) {
      releaseCategorizationSlot(
        userIdForRelease,
        slotReservation.claimedAt,
        slotReservation.previousLastCategorizedAt,
      )
    }

    Sentry.captureException(err)
    console.error("Categorization error:", err)
    return NextResponse.json({ error: "Failed to categorize repositories" }, { status: 500 })
  }
}
