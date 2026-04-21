import { createClient } from '@/lib/supabase/server'
import { fetchRepoReadme } from '@/lib/github'
import { getValidGitHubToken, updateGitHubToken } from '@/lib/tokens'
import { NextRequest, NextResponse } from 'next/server'

async function resolveGitHubToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const tokenResult = await getValidGitHubToken(userId)
  if (!tokenResult.error && tokenResult.token) return tokenResult

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.provider_token) {
    return tokenResult
  }

  await updateGitHubToken(userId, session.provider_token)
  return { token: session.provider_token as string }
}

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
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const tokenResult = await resolveGitHubToken(supabase, user.id)
    
    if (tokenResult.error === 'expired') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }
    
    if (tokenResult.error === 'not_found' || !tokenResult.token) {
      return NextResponse.json(
        { error: 'GitHub token not available' },
        { status: 401 }
      )
    }

    const result = await fetchRepoReadme(tokenResult.token, owner, repo)

    if (result.error === 'auth') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }

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
