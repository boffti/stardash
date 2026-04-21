import { createClient } from '@/lib/supabase/server'
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
    const number = searchParams.get('number')

    if (!owner || !repo || !number) {
      return NextResponse.json({ error: 'Missing owner, repo, or number parameter' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenResult = await resolveGitHubToken(supabase, user.id)

    if (tokenResult.error === 'expired') {
      return NextResponse.json({ error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' }, { status: 401 })
    }

    if (tokenResult.error === 'not_found' || !tokenResult.token) {
      return NextResponse.json({ error: 'GitHub token not available' }, { status: 401 })
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch issue' }, { status: res.status })
    }

    const issue = await res.json() as { body: string | null; user?: { login: string; avatar_url: string } | null; created_at: string; comments: number }

    return NextResponse.json({
      body: issue.body,
      author: issue.user?.login ?? null,
      authorAvatar: issue.user?.avatar_url ?? null,
      createdAt: issue.created_at,
      comments: issue.comments,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 })
  }
}
