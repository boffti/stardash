import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { appUrl, consumeSetupState, getGitHubApp, hasOwner, saveGitHubApp } from "@/lib/github-app"

/**
 * GitHub App manifest flow, step 2: GitHub redirects here with a temporary code after the
 * user clicks "Create GitHub App". Convert it into client credentials, store them once,
 * continue to OAuth. Credentials are never overwritten here.
 */
export async function GET(request: Request) {
  const origin = appUrl(request)
  const url = new URL(request.url)
  const redirectWithError = (error: string) =>
    NextResponse.redirect(`${origin}/auth/login?error=${error}`)
  const toStart = () => NextResponse.redirect(`${origin}/api/auth/github/start`)

  if (getGitHubApp()) return toStart()
  if (hasOwner() && !(await getUser())) return redirectWithError("owner")
  if (!consumeSetupState(url.searchParams.get("state"))) return redirectWithError("state")

  // GitHub's temporary manifest code is a hex-ish token; anything else never reaches the fetch.
  const code = url.searchParams.get("code") ?? ""
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) return redirectWithError("state")

  const res = await fetch(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    { method: "POST", headers: { Accept: "application/vnd.github+json" }, cache: "no-store" },
  )
  if (!res.ok) return redirectWithError("manifest")
  const app = (await res.json()) as { client_id: string; client_secret: string; slug: string }

  // Re-check after the network round trip: never overwrite an app that appeared meanwhile.
  if (getGitHubApp()) return toStart()
  if (hasOwner() && !(await getUser())) return redirectWithError("owner")
  saveGitHubApp(app.client_id, app.client_secret, app.slug)
  return toStart()
}
