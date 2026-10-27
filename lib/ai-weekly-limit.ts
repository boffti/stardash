import { db, nowIso } from "@/lib/db"

const DAY_MS = 24 * 60 * 60 * 1000

export type WeeklyLimitFeature = "brief" | "intel" | "search"

export interface WeeklyLimitResult {
  allowed: boolean
  remaining: number
  nextAllowedAt: string | null
  /** Set when allowed is false — distinguishes which window was exhausted. */
  limitType?: "weekly" | "daily"
}

// ponytail: self-hosted single-owner build, no AI quota. Hosted per-user
// weekly/daily limits (the old check_and_increment_ai_limit RPC) come back later.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function checkAndIncrementWeeklyLimit(
  _userId: string,
  _feature: WeeklyLimitFeature,
): Promise<WeeklyLimitResult> {
  return { allowed: true, remaining: 999, nextAllowedAt: null }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

// ── Personalized search: simple 24-hour per-user cooldown ────────────────────

export interface PersonalizedSearchLimitResult {
  allowed: boolean
  nextAllowedAt: string | null
}

export async function checkAndUpdatePersonalizedSearchLimit(
  userId: string,
): Promise<PersonalizedSearchLimitResult> {
  const row = db
    .prepare("select last_personalized_search_at from profiles where id = ?")
    .get(userId) as { last_personalized_search_at: string | null } | undefined

  const now = Date.now()
  const lastAt = row?.last_personalized_search_at
    ? new Date(row.last_personalized_search_at).getTime()
    : null

  if (lastAt && now - lastAt < DAY_MS) {
    return { allowed: false, nextAllowedAt: new Date(lastAt + DAY_MS).toISOString() }
  }

  db.prepare("update profiles set last_personalized_search_at = ? where id = ?").run(
    nowIso(),
    userId,
  )

  return { allowed: true, nextAllowedAt: null }
}
