import { createClient } from '@/lib/supabase/server'
import { fetchAllStarredRepos } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'
import { upsertStarredRepos } from '@/lib/user-metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const syncLog = {
    triggerKind: searchParams.get('triggerKind') ?? 'unknown',
    triggerSource: searchParams.get('triggerSource') ?? 'unknown',
    triggerContext: searchParams.get('triggerContext') ?? 'unknown',
  }

  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenResult = await getValidGitHubToken(user.id)
    
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

    const startedAt = Date.now()
    const scopedSyncLog = {
      ...syncLog,
      userId: user.id,
    }

    console.info('[github-star-sync:start]', scopedSyncLog)

    const repos = await fetchAllStarredRepos(tokenResult.token)
    const adminSupabase = createAdminClient()
    await upsertStarredRepos(adminSupabase, repos, user.id)

    supabase
      .from('profiles')
      .update({
        last_github_sync_at: new Date().toISOString(),
        total_starred_count: repos.length,
      })
      .eq('id', user.id)
      .then(() => {})

    console.info('[github-star-sync:success]', {
      ...scopedSyncLog,
      repoCount: repos.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ repos, lastSynced: new Date().toISOString() })
  } catch (error) {
    console.error('[github-star-sync:error]', {
      ...syncLog,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: 'Failed to fetch starred repos' }, { status: 500 })
  }
}
