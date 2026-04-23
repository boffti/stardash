import { createAdminClient } from '@/lib/supabase/admin'

const DAY_MS = 24 * 60 * 60 * 1000

export type WeeklyLimitFeature = 'brief' | 'intel' | 'search'

interface FeatureLimits {
  weekly: number
  daily?: number
}

// Limits are authoritative here and passed to the DB function at call time.
// The DB function (check_and_increment_ai_limit) enforces them atomically.
const LIMITS: Record<WeeklyLimitFeature, FeatureLimits> = {
  brief:  { weekly: 20, daily: 7 },
  intel:  { weekly: 10, daily: 5 },
  search: { weekly: 20, daily: 7 },
}

export interface WeeklyLimitResult {
  allowed: boolean
  remaining: number
  nextAllowedAt: string | null
  /** Set when allowed is false — distinguishes which window was exhausted. */
  limitType?: 'weekly' | 'daily'
}

// Shape returned by the check_and_increment_ai_limit Postgres function.
interface RpcResult {
  allowed: boolean
  remaining?: number
  nextAllowedAt?: string | null
  limitType?: 'weekly' | 'daily'
  error?: string
}

export async function checkAndIncrementWeeklyLimit(
  userId: string,
  feature: WeeklyLimitFeature,
): Promise<WeeklyLimitResult> {
  const admin  = createAdminClient()
  const limits = LIMITS[feature]

  // Delegate to the DB function which runs the check + increment inside a
  // single transaction with a row-level lock (SELECT … FOR UPDATE), preventing
  // the TOCTOU race where concurrent requests could both bypass the quota.
  const { data, error } = await admin.rpc('check_and_increment_ai_limit', {
    p_user_id:      userId,
    p_feature:      feature,
    p_weekly_limit: limits.weekly,
    p_daily_limit:  limits.daily ?? null,
  })

  if (error) throw error

  const result = data as RpcResult

  if (result.error) {
    throw new Error(`[ai-weekly-limit] DB function error: ${result.error}`)
  }

  return {
    allowed:      result.allowed,
    remaining:    result.remaining ?? 0,
    nextAllowedAt: result.nextAllowedAt ?? null,
    limitType:    result.limitType,
  }
}

// ── Personalized search: simple 24-hour per-user cooldown ────────────────────

export interface PersonalizedSearchLimitResult {
  allowed: boolean
  nextAllowedAt: string | null
}

export async function checkAndUpdatePersonalizedSearchLimit(
  userId: string,
): Promise<PersonalizedSearchLimitResult> {
  const admin = createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, last_personalized_search_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const now    = Date.now()
  const row    = profile as Record<string, unknown> | null
  const lastAt = row?.last_personalized_search_at
    ? new Date(row.last_personalized_search_at as string).getTime()
    : null

  if (lastAt && now - lastAt < DAY_MS) {
    return { allowed: false, nextAllowedAt: new Date(lastAt + DAY_MS).toISOString() }
  }

  await admin
    .from('profiles')
    .update({ last_personalized_search_at: new Date(now).toISOString() })
    .eq('id', userId)

  return { allowed: true, nextAllowedAt: null }
}
