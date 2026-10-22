import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/session-cookie"

// ponytail: presence check only; the HMAC is verified in getUser() where node:crypto is available.
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const { pathname } = request.nextUrl

  if (pathname === "/auth/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  const isProtected =
    !pathname.startsWith("/auth") && !pathname.startsWith("/api") && pathname !== "/"
  if (isProtected && !hasSession) {
    const url = new URL("/auth/login", request.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
