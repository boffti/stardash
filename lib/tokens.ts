import { cookies } from 'next/headers'

export interface TokenResult {
  token: string | null
  error?: 'expired' | 'not_found' | 'server'
}

export const GH_TOKEN_COOKIE = 'gh_token'
export const GH_TOKEN_MAX_AGE = 60 * 60 * 8 // 8 hours

/**
 * Reads the GitHub OAuth token from the httpOnly session cookie.
 * The cookie is set at OAuth callback and expires after 8 hours.
 */
export async function getValidGitHubToken(): Promise<TokenResult> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(GH_TOKEN_COOKIE)?.value
    if (!token) {
      return { token: null, error: 'not_found' }
    }
    return { token }
  } catch {
    return { token: null, error: 'server' }
  }
}

/**
 * Returns the server-side GitHub PAT for use in cron/admin contexts
 * where no user session cookie is available.
 * Requires GITHUB_PAT environment variable to be set.
 */
export async function getAnyValidGitHubToken(): Promise<TokenResult> {
  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return { token: null, error: 'not_found' }
  }
  return { token: pat }
}
