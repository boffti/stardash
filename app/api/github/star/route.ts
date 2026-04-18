import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidGitHubToken } from '@/lib/tokens'
import { unstarRepo } from '@/lib/github'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo, githubRepoId } = await request.json()

    if (!owner || !repo || !githubRepoId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tokenResult = await getValidGitHubToken()
    if (tokenResult.error === 'expired') {
      return NextResponse.json({ error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' }, { status: 401 })
    }
    if (tokenResult.error === 'not_found' || !tokenResult.token) {
      return NextResponse.json({ error: 'GitHub token not available. Please re-authenticate.' }, { status: 401 })
    }

    // Unstar on GitHub
    await unstarRepo(tokenResult.token, owner, repo)

    // Delete all associated data from Supabase
    const adminSupabase = createAdminClient()

    // Find the user_starred_repos row
    const { data: userRepoRow } = await adminSupabase
      .from('user_starred_repos')
      .select('id')
      .eq('user_id', user.id)
      .eq('github_repo_id', githubRepoId)
      .single()

    if (userRepoRow) {
      // Delete tag and collection assignments first (in case no cascade)
      await Promise.all([
        adminSupabase
          .from('user_starred_repo_tags')
          .delete()
          .eq('user_starred_repo_id', userRepoRow.id),
        adminSupabase
          .from('user_starred_repo_collections')
          .delete()
          .eq('user_starred_repo_id', userRepoRow.id),
      ])

      // Delete the user_starred_repos row
      await adminSupabase
        .from('user_starred_repos')
        .delete()
        .eq('id', userRepoRow.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Unstar error:', err)
    const message = err instanceof Error ? err.message : 'Failed to remove star'
    const status = message.includes('401') ? 401 : message.includes('403') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
