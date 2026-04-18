import { createAdminClient } from '@/lib/supabase/admin'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type WeeklyLimitFeature = 'brief' | 'intel'

const LIMITS: Record<WeeklyLimitFeature, number> = {
  brief: 10,
  intel: 10,
}

const WEEK_START_COL: Record<WeeklyLimitFeature, string> = {
  brief: 'ai_brief_week_start',
  intel: 'ai_intel_week_start',
}

const COUNT_COL: Record<WeeklyLimitFeature, string> = {
  brief: 'ai_brief_count',
  intel: 'ai_intel_count',
}

export interface WeeklyLimitResult {
  allowed: boolean
  remaining: number
  nextAllowedAt: string | null
}

export async function checkAndIncrementWeeklyLimit(
  userId: string,
  feature: WeeklyLimitFeature,
): Promise<WeeklyLimitResult> {
  const admin = createAdminClient()
  const weekCol = WEEK_START_COL[feature]
  const countCol = COUNT_COL[feature]
  const limit = LIMITS[feature]

  const { data: profile, error } = await admin
    .from('profiles')
    .select(`id, ${weekCol}, ${countCol}`)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const now = Date.now()
  const row = profile as Record<string, unknown> | null
  const weekStart = row?.[weekCol] ? new Date(row[weekCol] as string).getTime() : null
  const count = (row?.[countCol] as number) ?? 0

  const isNewWeek = !weekStart || now - weekStart >= WEEK_MS
  const currentCount = isNewWeek ? 0 : count
  const currentWeekStart = isNewWeek ? new Date(now).toISOString() : (row![weekCol] as string)

  if (currentCount >= limit) {
    const nextAllowedAt = new Date(weekStart! + WEEK_MS).toISOString()
    return { allowed: false, remaining: 0, nextAllowedAt }
  }

  await admin
    .from('profiles')
    .update({
      [weekCol]: currentWeekStart,
      [countCol]: currentCount + 1,
    })
    .eq('id', userId)

  return {
    allowed: true,
    remaining: limit - (currentCount + 1),
    nextAllowedAt: null,
  }
}
