import { createAdminClient } from '@/lib/supabase/admin'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS  = 24 * 60 * 60 * 1000

export type WeeklyLimitFeature = 'brief' | 'intel' | 'search'

interface FeatureLimits {
  weekly: number
  daily?: number
}

const LIMITS: Record<WeeklyLimitFeature, FeatureLimits> = {
  brief:  { weekly: 20, daily: 7 },
  intel:  { weekly: 10, daily: 5 },
  search: { weekly: 20, daily: 7 },
}

const WEEK_START_COL: Record<WeeklyLimitFeature, string> = {
  brief:  'ai_brief_week_start',
  intel:  'ai_intel_week_start',
  search: 'ai_search_week_start',
}

const COUNT_COL: Record<WeeklyLimitFeature, string> = {
  brief:  'ai_brief_count',
  intel:  'ai_intel_count',
  search: 'ai_search_count',
}

const DAY_START_COL: Record<WeeklyLimitFeature, string | undefined> = {
  brief:  'ai_brief_day_start',
  intel:  'ai_intel_day_start',
  search: 'ai_search_day_start',
}

const DAY_COUNT_COL: Record<WeeklyLimitFeature, string | undefined> = {
  brief:  'ai_brief_day_count',
  intel:  'ai_intel_day_count',
  search: 'ai_search_day_count',
}

export interface WeeklyLimitResult {
  allowed: boolean
  remaining: number
  nextAllowedAt: string | null
  /** Set when allowed is false — distinguishes which window was exhausted. */
  limitType?: 'weekly' | 'daily'
}

export async function checkAndIncrementWeeklyLimit(
  userId: string,
  feature: WeeklyLimitFeature,
): Promise<WeeklyLimitResult> {
  const admin = createAdminClient()
  const weekCol     = WEEK_START_COL[feature]
  const countCol    = COUNT_COL[feature]
  const dayStartCol = DAY_START_COL[feature]
  const dayCountCol = DAY_COUNT_COL[feature]
  const limits      = LIMITS[feature]
  const hasDailyLimit = limits.daily !== undefined && !!dayStartCol && !!dayCountCol

  const cols = ['id', weekCol, countCol, ...(hasDailyLimit ? [dayStartCol!, dayCountCol!] : [])]

  const { data: profile, error } = await admin
    .from('profiles')
    .select(cols.join(', '))
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const now = Date.now()
  const row = profile as Record<string, unknown> | null

  // ── Weekly window ──────────────────────────────────────────────────────────
  const weekStart    = row?.[weekCol] ? new Date(row[weekCol] as string).getTime() : null
  const weekCount    = (row?.[countCol] as number) ?? 0
  const isNewWeek    = !weekStart || now - weekStart >= WEEK_MS
  const curWeekCount = isNewWeek ? 0 : weekCount
  const curWeekStart = isNewWeek ? new Date(now).toISOString() : (row![weekCol] as string)

  if (curWeekCount >= limits.weekly) {
    return {
      allowed: false,
      remaining: 0,
      nextAllowedAt: new Date(weekStart! + WEEK_MS).toISOString(),
      limitType: 'weekly',
    }
  }

  // ── Daily window ───────────────────────────────────────────────────────────
  let curDayCount = 0
  let curDayStart = ''

  if (hasDailyLimit && dayStartCol && dayCountCol) {
    const dayStart = row?.[dayStartCol] ? new Date(row[dayStartCol] as string).getTime() : null
    const dayCount = (row?.[dayCountCol] as number) ?? 0
    const isNewDay = !dayStart || now - dayStart >= DAY_MS
    curDayCount    = isNewDay ? 0 : dayCount
    curDayStart    = isNewDay ? new Date(now).toISOString() : (row![dayStartCol] as string)

    if (curDayCount >= limits.daily!) {
      const dayStartMs = new Date(row![dayStartCol] as string).getTime()
      return {
        allowed: false,
        remaining: 0,
        nextAllowedAt: new Date(dayStartMs + DAY_MS).toISOString(),
        limitType: 'daily',
      }
    }
  }

  // ── Persist incremented counters ───────────────────────────────────────────
  const updates: Record<string, unknown> = {
    [weekCol]:  curWeekStart,
    [countCol]: curWeekCount + 1,
  }
  if (hasDailyLimit && dayStartCol && dayCountCol) {
    updates[dayStartCol] = curDayStart
    updates[dayCountCol] = curDayCount + 1
  }

  await admin.from('profiles').update(updates).eq('id', userId)

  const weeklyRemaining = limits.weekly - (curWeekCount + 1)
  const dailyRemaining  = hasDailyLimit ? limits.daily! - (curDayCount + 1) : weeklyRemaining

  return {
    allowed: true,
    remaining: Math.min(weeklyRemaining, dailyRemaining),
    nextAllowedAt: null,
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
