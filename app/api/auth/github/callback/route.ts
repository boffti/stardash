import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { appUrl, exchangeCode } from "@/lib/github-app"
import { signInWithGitHubToken } from "@/lib/github-login"
import { safeNext } from "@/lib/safe-next"
import { safeEqual } from "@/lib/session"
import { OAUTH_STATE_COOKIE } from "../start/route"

export async function GET(request: Request) {
  const origin = appUrl(request)
  const url = new URL(request.url)
  const cookieStore = await cookies()
  const state = url.searchParams.get("state")
  const code = url.searchParams.get("code")
  const expected = cookieStore.get(OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(OAUTH_STATE_COOKIE)

  if (!code || !state || !safeEqual(state, expected)) {
    return NextResponse.redirect(`${origin}/auth/login?error=state`)
  }

  const grant = await exchangeCode(code, `${origin}/api/auth/github/callback`)
  if (!grant.access_token) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(grant.error ?? "token")}`,
    )
  }

  const result = await signInWithGitHubToken(origin, {
    token: grant.access_token,
    expiresIn: grant.expires_in,
    refreshToken: grant.refresh_token,
    refreshExpiresIn: grant.refresh_token_expires_in,
  })
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(result.error)}`)
  }
  return NextResponse.redirect(`${origin}${safeNext(state.slice(state.indexOf(":") + 1))}`)
}
