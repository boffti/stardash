import { db, nowIso } from "@/lib/db"
import { getUser } from "@/lib/auth"
import { refreshToken } from "@/lib/github-app"

export interface TokenResult {
  token: string | null
  error?: "expired" | "not_found" | "server"
  source?: "stored" | "refreshed" | "env"
  reauthRequired?: boolean
}

interface StoredToken {
  github_token: string | null
  github_token_expires_at: string | null
  github_refresh_token: string | null
  github_refresh_token_expires_at: string | null
}

const REFRESH_SKEW_MS = 60_000
const expiresSoon = (iso: string | null) =>
  Boolean(iso) && new Date(iso!).getTime() - Date.now() < REFRESH_SKEW_MS

/** The user's GitHub token (PAT or GitHub App user token), refreshed if it is about to expire. */
export async function getValidGitHubToken(userId?: string): Promise<TokenResult> {
  const id = userId ?? (await getUser())?.id
  if (!id) return { token: null, error: "not_found", reauthRequired: true }
  const row = db
    .prepare(
      "select github_token, github_token_expires_at, github_refresh_token, github_refresh_token_expires_at from profiles where id = ?",
    )
    .get(id) as unknown as StoredToken | undefined
  if (!row?.github_token) return { token: null, error: "not_found", reauthRequired: true }
  if (!expiresSoon(row.github_token_expires_at))
    return { token: row.github_token, source: "stored" }

  if (!row.github_refresh_token || expiresSoon(row.github_refresh_token_expires_at)) {
    return { token: null, error: "expired", reauthRequired: true }
  }
  try {
    const fresh = await refreshToken(row.github_refresh_token)
    if (!fresh.access_token) return { token: null, error: "expired", reauthRequired: true }
    const at = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null)
    db.prepare(
      `update profiles set github_token = ?, github_token_expires_at = ?, github_refresh_token = ?,
         github_refresh_token_expires_at = ?, updated_at = ? where id = ?`,
    ).run(
      fresh.access_token,
      at(fresh.expires_in),
      fresh.refresh_token ?? row.github_refresh_token,
      at(fresh.refresh_token_expires_in) ?? row.github_refresh_token_expires_at,
      nowIso(),
      id,
    )
    return { token: fresh.access_token, source: "refreshed" }
  } catch {
    return { token: null, error: "server" }
  }
}

/** Token for background jobs: GITHUB_PAT if set, else the owner's token (refreshed as needed). */
export async function getAnyValidGitHubToken(): Promise<TokenResult> {
  if (process.env.GITHUB_PAT) return { token: process.env.GITHUB_PAT, source: "env" }
  const row = db.prepare("select id from profiles where github_token is not null limit 1").get() as
    { id: string } | undefined
  return row ? getValidGitHubToken(row.id) : { token: null, error: "not_found" }
}
