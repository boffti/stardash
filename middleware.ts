import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/session-cookie"

// ponytail: presence check only; the HMAC and expiry are verified in getUser() where node:crypto is available.
// No "already has a cookie" redirect away from /auth/login: a stale cookie must still be able to reach the form.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected =
    !pathname.startsWith("/auth") && !pathname.startsWith("/api") && pathname !== "/"
  if (isProtected && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/auth/login", request.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
