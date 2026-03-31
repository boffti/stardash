export type RepoHealthFilter = "archived" | "dormant"

export function isDormantRepo(pushedAt: string): boolean {
  const lastPush = new Date(pushedAt)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  return lastPush < twelveMonthsAgo
}
