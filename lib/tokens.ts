import { db } from "@/lib/db"
import { getUser } from "@/lib/auth"

export interface TokenResult {
  token: string | null
  error?: "expired" | "not_found" | "server"
  source?: "stored" | "env"
  reauthRequired?: boolean
}

/** The signed-in user's GitHub PAT, as stored at login. */
export async function getValidGitHubToken(userId?: string): Promise<TokenResult> {
  const id = userId ?? (await getUser())?.id
  if (!id) return { token: null, error: "not_found", reauthRequired: true }
  const row = db.prepare("select github_token from profiles where id = ?").get(id) as
    { github_token: string | null } | undefined
  return row?.github_token
    ? { token: row.github_token, source: "stored" }
    : { token: null, error: "not_found", reauthRequired: true }
}

/** Token for cron/background work: GITHUB_PAT if set, else the first user's token. */
export async function getAnyValidGitHubToken(): Promise<TokenResult> {
  if (process.env.GITHUB_PAT) return { token: process.env.GITHUB_PAT, source: "env" }
  const row = db
    .prepare("select github_token from profiles where github_token is not null limit 1")
    .get() as { github_token: string } | undefined
  return row ? { token: row.github_token, source: "stored" } : { token: null, error: "not_found" }
}
