import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session"

interface GitHubUser {
  id: number
  login: string
  avatar_url: string
}

export interface TokenGrant {
  token: string
  expiresIn?: number
  refreshToken?: string
  refreshExpiresIn?: number
}

const plusSeconds = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null)

/**
 * Shared tail of every login (PAT paste or OAuth): look the token's user up,
 * enforce single ownership, store the grant, set the session cookie.
 */
export async function signInWithGitHubToken(
  origin: string,
  grant: TokenGrant,
): Promise<{ ok: true; login: string } | { ok: false; error: string; status: number }> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${grant.token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, error: "GitHub rejected that token.", status: 401 }
  const gh = (await res.json()) as GitHubUser
  const githubId = String(gh.id)

  const owner = db.prepare("select github_id, github_username from profiles limit 1").get() as
    { github_id: string; github_username: string } | undefined
  if (owner && owner.github_id !== githubId) {
    return { ok: false, error: `This StarDash belongs to @${owner.github_username}.`, status: 403 }
  }

  db.prepare(
    `insert into profiles (id, github_id, github_username, github_avatar_url, github_token,
                           github_token_expires_at, github_refresh_token, github_refresh_token_expires_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set
       github_username = excluded.github_username,
       github_avatar_url = excluded.github_avatar_url,
       github_token = excluded.github_token,
       github_token_expires_at = excluded.github_token_expires_at,
       github_refresh_token = excluded.github_refresh_token,
       github_refresh_token_expires_at = excluded.github_refresh_token_expires_at,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(
    githubId,
    githubId,
    gh.login,
    gh.avatar_url,
    grant.token,
    plusSeconds(grant.expiresIn),
    grant.refreshToken ?? null,
    plusSeconds(grant.refreshExpiresIn),
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, signSession(githubId), sessionCookieOptions(origin))
  return { ok: true, login: gh.login }
}
