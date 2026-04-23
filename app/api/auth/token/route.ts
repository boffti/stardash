import { createClient } from '@/lib/supabase/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { NextResponse } from 'next/server'

// Cache GitHub /user validation results per user for 5 minutes so that
// repeated page-focus checks don't burn through the 5,000/hr GitHub quota.
interface ValidationCacheEntry {
  source?: string
  expiresAt: number
}
const validationCache = new Map<string, ValidationCacheEntry>()
const VALIDATION_CACHE_MS = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getValidGitHubToken()
    
    if (result.error === 'not_found') {
      return NextResponse.json(
        { error: 'Token not found — please re-authenticate', code: 'GITHUB_REAUTH_REQUIRED', reauthRequired: true },
        { status: 401 }
      )
    }

    if (result.error === 'expired') {
      return NextResponse.json(
        { error: 'GitHub token expired — please re-authenticate', code: 'GITHUB_REAUTH_REQUIRED', reauthRequired: true },
        { status: 401 }
      )
    }
    
    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to get token' },
        { status: 500 }
      )
    }
    
    if (!result.token) {
      return NextResponse.json(
        { error: 'Token not found — please re-authenticate', code: 'GITHUB_REAUTH_REQUIRED', reauthRequired: true },
        { status: 401 }
      )
    }

    // Return cached validation result if still fresh (avoids a GitHub API call).
    // Delete expired entries on read so they don't linger indefinitely.
    const cached = validationCache.get(user.id)
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return NextResponse.json({ valid: true, source: cached.source, cached: true })
      }
      validationCache.delete(user.id)
    }

    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${result.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (githubResponse.status === 401 || githubResponse.status === 403) {
      validationCache.delete(user.id)
      return NextResponse.json(
        { error: 'GitHub token is invalid — please re-authenticate', code: 'GITHUB_REAUTH_REQUIRED', reauthRequired: true },
        { status: 401 }
      )
    }

    // Cache successful validation
    validationCache.set(user.id, { source: result.source, expiresAt: Date.now() + VALIDATION_CACHE_MS })

    return NextResponse.json({ valid: true, source: result.source })
  } catch {
    return NextResponse.json(
      { error: 'Failed to check token' },
      { status: 500 }
    )
  }
}
