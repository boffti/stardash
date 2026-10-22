import { randomBytes } from "node:crypto"
import { db } from "@/lib/db"

// GitHub App credentials: env wins (pre-made app, hosted demo), else the app this
// instance created for itself through the manifest flow, stored in `meta`.
export function getGitHubApp(): { clientId: string; clientSecret: string } | null {
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }
  }
  const rows = db
    .prepare("select key, value from meta where key in ('gh_client_id', 'gh_client_secret')")
    .all() as { key: string; value: string }[]
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return m.gh_client_id && m.gh_client_secret
    ? { clientId: m.gh_client_id, clientSecret: m.gh_client_secret }
    : null
}

export function saveGitHubApp(clientId: string, clientSecret: string, slug: string) {
  const put = db.prepare("insert or replace into meta (key, value) values (?, ?)")
  put.run("gh_client_id", clientId)
  put.run("gh_client_secret", clientSecret)
  put.run("gh_app_slug", slug)
}

/** Public origin of this instance. APP_URL beats proxy headers beats request URL. */
export function appUrl(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")
  return host ? `${proto}://${host}` : new URL(request.url).origin
}

export const newState = () => randomBytes(16).toString("hex")

export function manifestFor(origin: string) {
  const host = new URL(origin).hostname.replace(/[^a-z0-9]+/gi, "-").slice(0, 20)
  return {
    // ponytail: GitHub App names are globally unique, hence the random suffix.
    name: `stardash-${host}-${randomBytes(2).toString("hex")}`.toLowerCase(),
    url: origin,
    description: "Your self-hosted StarDash instance. Created and owned by you.",
    hook_attributes: { active: false },
    redirect_url: `${origin}/api/auth/github/setup`,
    callback_urls: [`${origin}/api/auth/github/callback`],
    public: false,
    default_permissions: { metadata: "read", starring: "write" },
  }
}

export interface GitHubTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  error?: string
  error_description?: string
}

async function tokenRequest(params: Record<string, string>): Promise<GitHubTokenResponse> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  })
  return (await res.json()) as GitHubTokenResponse
}

export function exchangeCode(code: string, redirectUri: string) {
  const app = getGitHubApp()
  if (!app) throw new Error("GitHub App not configured")
  return tokenRequest({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    code,
    redirect_uri: redirectUri,
  })
}

export function refreshToken(refresh: string) {
  const app = getGitHubApp()
  if (!app) throw new Error("GitHub App not configured")
  return tokenRequest({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
  })
}
