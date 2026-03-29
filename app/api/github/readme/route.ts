import { createClient } from '@/lib/supabase/server'
import { fetchRepoReadme } from '@/lib/github'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const owner = searchParams.get('owner')
    const repo = searchParams.get('repo')

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const providerToken = session.provider_token
    
    if (!providerToken) {
      return NextResponse.json(
        { error: 'GitHub token not available' },
        { status: 401 }
      )
    }

    const result = await fetchRepoReadme(providerToken, owner, repo)

    // Handle auth error from GitHub API (token expired/revoked)
    if (result.error === 'auth') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }

    // Return readme content (null if not found) or server error
    return NextResponse.json({ 
      readme: result.content,
      error: result.error === 'server' ? 'Failed to fetch README' : undefined
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch README' },
      { status: 500 }
    )
  }
}
