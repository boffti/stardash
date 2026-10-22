import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session"

interface GitHubUser {
  id: number
  login: string
  avatar_url: string
}

// Paste-a-PAT login. First PAT ever seen claims this instance; later logins must be the same GitHub user.
export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string }
  if (
    typeof token !== "string" ||
    !/^(gh[pou]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(token.trim())
  ) {
    return NextResponse.json({ error: "That does not look like a GitHub token." }, { status: 400 })
  }
  const pat = token.trim()

  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  })
  if (!res.ok) {
    return NextResponse.json({ error: "GitHub rejected that token." }, { status: 401 })
  }
  const gh = (await res.json()) as GitHubUser
  const githubId = String(gh.id)

  const owner = db.prepare("select id, github_id, github_username from profiles limit 1").get() as
    { id: string; github_id: string; github_username: string } | undefined
  if (owner && owner.github_id !== githubId) {
    return NextResponse.json(
      { error: `This StarDash belongs to @${owner.github_username}.` },
      { status: 403 },
    )
  }

  db.prepare(
    `insert into profiles (id, github_id, github_username, github_avatar_url, github_token)
     values (?, ?, ?, ?, ?)
     on conflict (id) do update set
       github_username = excluded.github_username,
       github_avatar_url = excluded.github_avatar_url,
       github_token = excluded.github_token,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(githubId, githubId, gh.login, gh.avatar_url, pat)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, signSession(githubId), sessionCookieOptions)
  return NextResponse.json({ ok: true, login: gh.login })
}
