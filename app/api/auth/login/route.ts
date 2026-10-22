import { NextResponse } from "next/server"
import { appUrl } from "@/lib/github-app"
import { signInWithGitHubToken } from "@/lib/github-login"

// Fallback login: paste a personal access token.
export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string }
  if (
    typeof token !== "string" ||
    !/^(gh[pou]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(token.trim())
  ) {
    return NextResponse.json({ error: "That does not look like a GitHub token." }, { status: 400 })
  }
  const result = await signInWithGitHubToken(appUrl(request), { token: token.trim() })
  return result.ok
    ? NextResponse.json({ ok: true, login: result.login })
    : NextResponse.json({ error: result.error }, { status: result.status })
}
