import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { categorizeRepos } from '@/lib/ai-categorize'
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
const AI_CATEGORIZATION_COOLDOWN_MS = 24 * 60 * 60 * 1000

interface UserRepoRow {
  id: string
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

  return `AI categorization is limited to once every 24 hours. Try again after ${nextAllowedLabel} UTC.`
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

export async function POST(request: Request) {
  let slotReservation: CategorizationSlotReservation | null = null
  let userIdForRelease: string | null = null

  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { repos } = await request.json()

    if (!repos?.length) {
      return NextResponse.json({ error: 'No repos provided' }, { status: 400 })
    }

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

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured on server' }, { status: 500 })
    }

    const result = await categorizeRepos(repos, apiKey)
    const { data: userRepoRows, error: userRepoError } = await adminSupabase
      .from('user_starred_repos')
      .select('id, repos!inner(github_repo_id)')
      .eq('user_id', user.id)

    if (userRepoError) {
      throw userRepoError
    }

    const repoIdMap = new Map<number, string>()
    for (const row of (userRepoRows ?? []) as UserRepoRow[]) {
      const repo = Array.isArray(row.repos) ? row.repos[0] : row.repos
      repoIdMap.set(repo.github_repo_id, row.id)
    }

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
