import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { appUrl, getGitHubApp, newState } from "@/lib/github-app"

export const OAUTH_STATE_COOKIE = "sd_oauth_state"

export async function GET(request: Request) {
  const origin = appUrl(request)
  const app = getGitHubApp()
  if (!app) return NextResponse.redirect(`${origin}/api/auth/github/setup`)

  const next = new URL(request.url).searchParams.get("next") ?? "/dashboard"
  const state = `${newState()}:${next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"}`
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })

  const authorize = new URL("https://github.com/login/oauth/authorize")
  authorize.searchParams.set("client_id", app.clientId)
  authorize.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`)
  authorize.searchParams.set("state", state)
  return NextResponse.redirect(authorize)
}
