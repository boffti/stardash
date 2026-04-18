import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { categorizeRepos } from '@/lib/ai-categorize'
import { getAIModel, type AIModelConfig } from '@/lib/ai-provider'
import { langfuseSpanProcessor } from '@/instrumentation'
import {
  ensureCollections,
  ensureTags,
  normalizeCollectionName,
  normalizeTagLabel,
} from '@/lib/user-metadata'
import type { CategorizationResult } from '@/lib/types'

export const maxDuration = 120

const ASSIGNMENT_BATCH_SIZE = 500
const AI_CATEGORIZATION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

interface UserRepoRow {
  id: string
  starred_at: string | null
  created_at: string
  repos: {
    github_repo_id: number
  } | {
    github_repo_id: number
  }[]
}

interface ProfileCategorizationRow {
  id: string
  last_ai_categorization_at: string | null
}

interface ExistingTagRow {
  id: string
  label: string
  color: string
}

interface ExistingCollectionRow {
  id: string
  name: string
  emoji: string | null
  color: string | null
}

interface CategorizationSlotReservation {
  allowed: boolean
  claimedAt: string | null
  previousLastCategorizedAt: string | null
  nextAllowedAt: string | null
}

function formatCooldownMessage(nextAllowedAt: string) {
  const nextAllowedLabel = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(nextAllowedAt))

  return `AI categorization is limited to once per week. Try again after ${nextAllowedLabel} UTC.`
}

async function reserveCategorizationSlot(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  attempt = 0
): Promise<CategorizationSlotReservation> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, last_ai_categorization_at')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw profileError

  const previousLastCategorizedAt = (profile as ProfileCategorizationRow | null)?.last_ai_categorization_at ?? null
  const now = Date.now()

  if (previousLastCategorizedAt) {
    const nextAllowedAt = new Date(
      new Date(previousLastCategorizedAt).getTime() + AI_CATEGORIZATION_COOLDOWN_MS
    ).toISOString()

    if (new Date(nextAllowedAt).getTime() > now) {
      return {
        allowed: false,
        claimedAt: null,
        previousLastCategorizedAt,
        nextAllowedAt,
      }
    }
  }

  const claimedAt = new Date(now).toISOString()

  if (!profile) {
    const { data: insertedProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, last_ai_categorization_at: claimedAt })
      .select('id')
      .maybeSingle()

    if (insertError) throw insertError
    if (!insertedProfile) {
      throw new Error('Failed to initialize AI categorization limit for user')
    }

    return {
      allowed: true,
      claimedAt,
      previousLastCategorizedAt: null,
      nextAllowedAt: new Date(now + AI_CATEGORIZATION_COOLDOWN_MS).toISOString(),
    }
  }

  let updateQuery = supabase
    .from('profiles')
    .update({ last_ai_categorization_at: claimedAt })
    .eq('id', userId)

  updateQuery = previousLastCategorizedAt
    ? updateQuery.eq('last_ai_categorization_at', previousLastCategorizedAt)
    : updateQuery.is('last_ai_categorization_at', null)

  const { data: updatedProfile, error: updateError } = await updateQuery
    .select('id')
    .maybeSingle()

  if (updateError) throw updateError

  if (!updatedProfile) {
    if (attempt >= 1) {
      throw new Error('Failed to reserve AI categorization slot')
    }

    return reserveCategorizationSlot(supabase, userId, attempt + 1)
  }

  return {
    allowed: true,
    claimedAt,
    previousLastCategorizedAt,
    nextAllowedAt: new Date(now + AI_CATEGORIZATION_COOLDOWN_MS).toISOString(),
  }
}

async function releaseCategorizationSlot(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  claimedAt: string,
  previousLastCategorizedAt: string | null
) {
  const { error } = await supabase
    .from('profiles')
    .update({ last_ai_categorization_at: previousLastCategorizedAt })
    .eq('id', userId)
    .eq('last_ai_categorization_at', claimedAt)

  if (error) {
    console.error('Failed to release AI categorization slot:', error)
  }
}

async function upsertAssignments(
  supabase: ReturnType<typeof createAdminClient>,
  table: 'user_starred_repo_tags' | 'user_starred_repo_collections',
  rows: Record<string, string>[],
  onConflict: string
) {
  for (let i = 0; i < rows.length; i += ASSIGNMENT_BATCH_SIZE) {
    const batch = rows.slice(i, i + ASSIGNMENT_BATCH_SIZE)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict })

    if (error) throw error
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
  previousLastCategorizedAt: string | null
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
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    modelConfig = getAIModel(request)

    if (!modelConfig.isUserKey) {
      userIdForRelease = user.id
      slotReservation = await reserveCategorizationSlot(adminSupabase, user.id)

      if (!slotReservation.allowed) {
        return NextResponse.json(
          {
            error: formatCooldownMessage(slotReservation.nextAllowedAt!),
            nextAllowedAt: slotReservation.nextAllowedAt,
          },
          { status: 429 }
        )
      }
    }

    const { repos } = await request.json()

    if (!repos?.length) {
      return NextResponse.json({ error: 'No repos provided' }, { status: 400 })
    }

    const [
      userRepoResult,
      existingTagsResult,
      existingCollectionsResult,
    ] = await Promise.all([
      adminSupabase
        .from('user_starred_repos')
        .select('id, starred_at, created_at, repos!inner(github_repo_id)')
        .eq('user_id', user.id),
      supabase
        .from('tags')
        .select('id, label, color')
        .eq('user_id', user.id),
      supabase
        .from('collections')
        .select('id, name, emoji, color')
        .eq('user_id', user.id),
    ])

    if (userRepoResult.error || existingTagsResult.error || existingCollectionsResult.error) {
      throw userRepoResult.error || existingTagsResult.error || existingCollectionsResult.error
    }

    const repoIdMap = new Map<number, string>()
    const reposToCategorizeIdSet = new Set<number>()
    for (const row of (userRepoResult.data ?? []) as UserRepoRow[]) {
      const repo = Array.isArray(row.repos) ? row.repos[0] : row.repos
      repoIdMap.set(repo.github_repo_id, row.id)
      if (repoWasStarredAfterLastCategorization(row, slotReservation?.previousLastCategorizedAt ?? null)) {
        reposToCategorizeIdSet.add(repo.github_repo_id)
      }
    }

    const reposToCategorize = repos.filter((repo: { id: string }) => (
      reposToCategorizeIdSet.has(Number(repo.id))
    ))

    const existingTags = ((existingTagsResult.data ?? []) as ExistingTagRow[]).map((tag) => ({
      id: tag.id,
      label: tag.label,
      color: tag.color,
    }))
    const existingCollections = ((existingCollectionsResult.data ?? []) as ExistingCollectionRow[]).map((collection) => ({
      id: collection.id,
      name: collection.name,
      emoji: collection.emoji || '',
      color: collection.color || '#64748b',
      repoCount: 0,
    }))

    if (reposToCategorize.length === 0) {
      if (slotReservation?.claimedAt) {
        await releaseCategorizationSlot(
          adminSupabase,
          user.id,
          slotReservation.claimedAt,
          slotReservation.previousLastCategorizedAt
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
      existingTaxonomy: slotReservation?.previousLastCategorizedAt
        ? { collections: existingCollections, tags: existingTags }
        : undefined,
    })

    const persistedTags = await ensureTags(supabase, user.id, result.allTags)
    const persistedCollections = await ensureCollections(supabase, user.id, result.collections)

    const tagByLabel = new Map(
      persistedTags.map((tag) => [normalizeTagLabel(tag.label), tag])
    )
    const collectionByName = new Map(
      persistedCollections.map((collection) => [normalizeCollectionName(collection.name), collection])
    )

    const tagAssignments: Array<{ user_starred_repo_id: string; user_id: string; tag_id: string }> = []
    const collectionAssignments: Array<{ user_starred_repo_id: string; user_id: string; collection_id: string }> = []
    const persistedRepoTags: CategorizationResult['repoTags'] = {}
    const persistedRepoCollections: CategorizationResult['repoCollections'] = {}
    const collectionRepoCounts = new Map<string, number>()

    for (const [repoId, tags] of Object.entries(result.repoTags)) {
      const userStarredRepoId = repoIdMap.get(Number(repoId))
      if (!userStarredRepoId) continue

      const persistedRepoTagList = tags
        .map((tag) => tagByLabel.get(normalizeTagLabel(tag.label)))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))

      if (persistedRepoTagList.length > 0) {
        persistedRepoTags[repoId] = persistedRepoTagList
        tagAssignments.push(
          ...persistedRepoTagList.map((tag) => ({
            user_starred_repo_id: userStarredRepoId,
            user_id: user.id,
            tag_id: tag.id,
          }))
        )
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
        persistedRepoCollections[repoId] = persistedCollectionIds.map((collection) => collection.id)
        for (const collection of persistedCollectionIds) {
          collectionRepoCounts.set(collection.id, (collectionRepoCounts.get(collection.id) ?? 0) + 1)
        }
        collectionAssignments.push(
          ...persistedCollectionIds.map((collection) => ({
            user_starred_repo_id: userStarredRepoId,
            user_id: user.id,
            collection_id: collection.id,
          }))
        )
      }
    }

    if (tagAssignments.length > 0) {
      await upsertAssignments(adminSupabase, 'user_starred_repo_tags', tagAssignments, 'user_starred_repo_id,tag_id')
    }

    if (collectionAssignments.length > 0) {
      await upsertAssignments(
        adminSupabase,
        'user_starred_repo_collections',
        collectionAssignments,
        'user_starred_repo_id,collection_id'
      )
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

    after(async () => { await langfuseSpanProcessor?.forceFlush() })
    return NextResponse.json(persistedResult)
  } catch (err) {
    if (slotReservation?.allowed && slotReservation.claimedAt && userIdForRelease) {
      const adminSupabase = createAdminClient()
      await releaseCategorizationSlot(
        adminSupabase,
        userIdForRelease,
        slotReservation.claimedAt,
        slotReservation.previousLastCategorizedAt
      )
    }

    Sentry.captureException(err)
    console.error('Categorization error:', err)
    return NextResponse.json({ error: 'Failed to categorize repositories' }, { status: 500 })
  }
}
