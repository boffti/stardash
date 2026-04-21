import { createClient } from '@/lib/supabase/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { NextResponse } from 'next/server'

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

    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${result.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (githubResponse.status === 401 || githubResponse.status === 403) {
      return NextResponse.json(
        { error: 'GitHub token is invalid — please re-authenticate', code: 'GITHUB_REAUTH_REQUIRED', reauthRequired: true },
        { status: 401 }
      )
    }

    return NextResponse.json({ valid: true, source: result.source })
  } catch {
    return NextResponse.json(
      { error: 'Failed to check token' },
      { status: 500 }
    )
  }
}
