import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { appUrl, getGitHubApp, hasOwner, issueSetupState, manifestFor } from "@/lib/github-app"

/**
 * GitHub App manifest flow, step 1: an auto-submitting form that asks GitHub to create
 * an app owned by the signed-in GitHub user, for this origin. GitHub redirects back to
 * ./callback. Once an app exists this only forwards to /start; once the instance is
 * claimed (PAT login) only the signed-in owner may attach an app.
 */
export async function GET(request: Request) {
  const origin = appUrl(request)
  if (getGitHubApp()) return NextResponse.redirect(`${origin}/api/auth/github/start`)
  if (hasOwner() && !(await getUser()))
    return NextResponse.redirect(`${origin}/auth/login?error=owner`)

  const manifest = JSON.stringify(manifestFor(origin))
  const html = `<!doctype html><meta charset="utf-8"><title>Connecting GitHub…</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0a0a0a;color:#ddd">
<form method="post" action="https://github.com/settings/apps/new?state=${issueSetupState()}">
  <input type="hidden" name="manifest" value="${manifest.replace(/"/g, "&quot;")}">
  <p>Taking you to GitHub to create your own StarDash app…</p>
  <noscript><button type="submit">Continue to GitHub</button></noscript>
</form>
<script>document.forms[0].submit()</script>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
