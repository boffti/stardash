import { createClient } from '@/lib/supabase/server'
import { fetchAllStarredRepos } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'
import { upsertStarredRepos } from '@/lib/user-metadata'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenResult = await getValidGitHubToken(session.user.id)
    
    if (tokenResult.error === 'expired') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }
    
    if (tokenResult.error === 'not_found' || !tokenResult.token) {
      return NextResponse.json(
        { error: 'GitHub token not available. Please re-authenticate.' },
        { status: 401 }
      )
    }

    const repos = await fetchAllStarredRepos(tokenResult.token)
    await upsertStarredRepos(supabase, repos, session.user.id)

    supabase
      .from('profiles')
      .update({
        last_github_sync_at: new Date().toISOString(),
        total_starred_count: repos.length,
      })
      .eq('id', session.user.id)
      .then(() => {})

    return NextResponse.json({ repos, lastSynced: new Date().toISOString() })
  } catch (error) {
    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: 'Failed to fetch starred repos' }, { status: 500 })
  }
}
