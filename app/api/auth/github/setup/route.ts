import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { appUrl, getGitHubApp, manifestFor, newState, saveGitHubApp } from "@/lib/github-app"

const STATE_COOKIE = "sd_setup_state"

const hasOwner = () => Boolean(db.prepare("select 1 from profiles limit 1").get())

/**
 * GitHub App manifest flow. Without ?code: render an auto-submitting form that asks
 * GitHub to create an app owned by the signed-in GitHub user, for this origin.
 * With ?code (GitHub's redirect back): convert it into client credentials, store
 * them, and continue to the normal OAuth start.
 *
 * Guards: once an app exists this route only forwards to /start (credentials are
 * never overwritten here); if the instance is already claimed (PAT login) only the
 * signed-in owner may attach an app.
 */
export async function GET(request: Request) {
  const origin = appUrl(request)
  const url = new URL(request.url)
  const cookieStore = await cookies()
  const login = (error: string) => NextResponse.redirect(`${origin}/auth/login?error=${error}`)

  if (getGitHubApp()) return NextResponse.redirect(`${origin}/api/auth/github/start`)
  if (hasOwner() && !(await getUser())) return login("owner")

  const code = url.searchParams.get("code")
  if (code) {
    // GitHub's temporary manifest code is a hex-ish token; anything else never reaches the fetch.
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) return login("state")
    const expected = cookieStore.get(STATE_COOKIE)?.value
    if (!expected || expected !== url.searchParams.get("state")) return login("state")

    const res = await fetch(
      `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
      { method: "POST", headers: { Accept: "application/vnd.github+json" }, cache: "no-store" },
    )
    if (!res.ok) return login("manifest")
    const app = (await res.json()) as { client_id: string; client_secret: string; slug: string }

    // Re-check after the network round trip: never overwrite an app that appeared meanwhile.
    if (getGitHubApp()) return NextResponse.redirect(`${origin}/api/auth/github/start`)
    if (hasOwner() && !(await getUser())) return login("owner")
    saveGitHubApp(app.client_id, app.client_secret, app.slug)

    const next = NextResponse.redirect(`${origin}/api/auth/github/start`)
    next.cookies.delete(STATE_COOKIE)
    return next
  }

  const state = newState()
  cookieStore.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 })
  const manifest = JSON.stringify(manifestFor(origin))
  const html = `<!doctype html><meta charset="utf-8"><title>Connecting GitHub…</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0a0a0a;color:#ddd">
<form method="post" action="https://github.com/settings/apps/new?state=${state}">
  <input type="hidden" name="manifest" value="${manifest.replace(/"/g, "&quot;")}">
  <p>Taking you to GitHub to create your own StarDash app…</p>
  <noscript><button type="submit">Continue to GitHub</button></noscript>
</form>
<script>document.forms[0].submit()</script>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
