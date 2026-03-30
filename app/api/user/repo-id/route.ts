import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const githubRepoIdParam = new URL(request.url).searchParams.get('githubRepoId')
    const githubRepoId = githubRepoIdParam ? parseInt(githubRepoIdParam, 10) : NaN

    if (!Number.isFinite(githubRepoId)) {
      return NextResponse.json({ error: 'githubRepoId is required' }, { status: 400 })
    }

    const { data: repoRow, error: repoError } = await adminSupabase
      .from('repos')
      .select('id')
      .eq('github_repo_id', githubRepoId)
      .maybeSingle()

    if (repoError) {
      throw repoError
    }

    if (!repoRow) {
      return NextResponse.json({ error: 'Repo not synced yet' }, { status: 404 })
    }

    const { data: userStarredRepo, error: userStarredRepoError } = await adminSupabase
      .from('user_starred_repos')
      .select('id')
      .eq('user_id', user.id)
      .eq('repo_id', repoRow.id)
      .maybeSingle()

    if (userStarredRepoError) {
      throw userStarredRepoError
    }

    if (!userStarredRepo) {
      return NextResponse.json({ error: 'User star relation not synced yet' }, { status: 404 })
    }

    return NextResponse.json({ dbId: userStarredRepo.id })
  } catch {
    return NextResponse.json({ error: 'Failed to resolve repo metadata' }, { status: 500 })
  }
}
