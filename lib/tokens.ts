import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface TokenResult {
  token: string | null
  error?: 'expired' | 'not_found' | 'server'
  source?: 'cookie' | 'stored' | 'refreshed'
  reauthRequired?: boolean
}

export const GH_TOKEN_COOKIE = 'gh_token'
export const GH_TOKEN_MAX_AGE = 60 * 60 * 8 // 8 hours
const GH_REFRESH_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180 // 6 months

interface StoredGitHubToken {
  provider_token: string | null
  provider_refresh_token: string | null
  token_expires_at: string | null
  refresh_token_expires_at: string | null
}

interface GitHubRefreshResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  error?: string
}

function cookieOptions(maxAge = GH_TOKEN_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

async function getCurrentUserId() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

function isExpired(value: string | null | undefined) {
  return Boolean(value && Date.now() >= new Date(value).getTime())
}

async function readStoredToken(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('github_oauth_tokens')
    .select('provider_token, provider_refresh_token, token_expires_at, refresh_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[github-token] stored token lookup failed:', error)
    return null
  }

  return data as StoredGitHubToken | null
}

async function updateStoredToken(
  userId: string,
  token: string,
  refreshToken?: string | null,
  expiresIn?: number,
  refreshExpiresIn?: number,
) {
  const admin = createAdminClient()
  const now = new Date()
  const tokenExpiresAt = typeof expiresIn === 'number'
    ? new Date(now.getTime() + expiresIn * 1000).toISOString()
    : null
  const refreshTokenExpiresAt = typeof refreshExpiresIn === 'number'
    ? new Date(now.getTime() + refreshExpiresIn * 1000).toISOString()
    : refreshToken
      ? new Date(now.getTime() + GH_REFRESH_TOKEN_MAX_AGE_MS).toISOString()
      : null

  const { error } = await admin.from('github_oauth_tokens').upsert({
    user_id: userId,
    provider_token: token,
    provider_refresh_token: refreshToken ?? null,
    token_expires_at: tokenExpiresAt,
    refresh_token_expires_at: refreshTokenExpiresAt,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    console.error('[github-token] stored token update failed:', error)
  }
}

async function refreshStoredGitHubToken(userId: string, refreshToken: string) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!res.ok) return null

  const data = await res.json() as GitHubRefreshResponse
  if (!data.access_token || data.error) return null

  await updateStoredToken(
    userId,
    data.access_token,
    data.refresh_token ?? refreshToken,
    data.expires_in,
    data.refresh_token_expires_in,
  )

  return data.access_token
}

export async function storeGitHubOAuthToken({
  userId,
  token,
  refreshToken,
  expiresIn,
  refreshExpiresIn,
}: {
  userId: string
  token: string
  refreshToken?: string | null
  expiresIn?: number
  refreshExpiresIn?: number
}) {
  await updateStoredToken(userId, token, refreshToken, expiresIn, refreshExpiresIn)
}

async function setGitHubTokenCookie(token: string) {
  try {
    const cookieStore = await cookies()
    cookieStore.set(GH_TOKEN_COOKIE, token, cookieOptions())
  } catch {
    // Cookie repair only works from route handlers/server actions.
  }
}

/**
 * Reads the GitHub OAuth token from the httpOnly session cookie.
 * If the cookie is missing, repairs it from the server-only token store when possible.
 */
export async function getValidGitHubToken(userId?: string): Promise<TokenResult> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(GH_TOKEN_COOKIE)?.value
    if (token) {
      return { token, source: 'cookie' }
    }

    const resolvedUserId = userId ?? await getCurrentUserId()
    if (!resolvedUserId) {
      return { token: null, error: 'not_found', reauthRequired: true }
    }

    const stored = await readStoredToken(resolvedUserId)
    if (!stored?.provider_token) {
      return { token: null, error: 'not_found', reauthRequired: true }
    }

    if (!isExpired(stored.token_expires_at)) {
      await setGitHubTokenCookie(stored.provider_token)
      return { token: stored.provider_token, source: 'stored' }
    }

    if (
      stored.provider_refresh_token &&
      !isExpired(stored.refresh_token_expires_at)
    ) {
      const refreshedToken = await refreshStoredGitHubToken(resolvedUserId, stored.provider_refresh_token)
      if (refreshedToken) {
        await setGitHubTokenCookie(refreshedToken)
        return { token: refreshedToken, source: 'refreshed' }
      }
    }

    return { token: null, error: 'expired', reauthRequired: true }
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
