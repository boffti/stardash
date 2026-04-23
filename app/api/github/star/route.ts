import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidGitHubToken } from '@/lib/tokens'
import { starRepo, unstarRepo } from '@/lib/github'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { checkRateLimit } from '@/lib/rate-limit'

// Max 10 star/unstar actions per user per minute to protect GitHub API quota
const STAR_RATE_LIMIT = 10
const STAR_RATE_WINDOW_MS = 60_000

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(`${user.id}:star`, STAR_RATE_LIMIT, STAR_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many star/unstar requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      )
    }

    const { owner, repo, githubRepoId, collectionIds, tagIds } = await request.json()
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tokenResult = await getValidGitHubToken()
    if (tokenResult.error || !tokenResult.token) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 401 })
    }

    await starRepo(tokenResult.token, owner, repo)

    // Upsert tag/collection assignments if provided
    if (githubRepoId && (collectionIds?.length || tagIds?.length)) {
      const adminSupabase = createAdminClient()

      const { data: userRepoRow } = await adminSupabase
        .from('user_starred_repos')
        .select('id')
        .eq('user_id', user.id)
        .eq('github_repo_id', githubRepoId)
        .maybeSingle()

      if (userRepoRow) {
        const assignments: Promise<unknown>[] = []
        if (tagIds?.length) {
          assignments.push(
            adminSupabase.from('user_starred_repo_tags').upsert(
              tagIds.map((tag_id: string) => ({ user_starred_repo_id: userRepoRow.id, user_id: user.id, tag_id })),
              { onConflict: 'user_starred_repo_id,tag_id' }
            )
          )
        }
        if (collectionIds?.length) {
          assignments.push(
            adminSupabase.from('user_starred_repo_collections').upsert(
              collectionIds.map((collection_id: string) => ({ user_starred_repo_id: userRepoRow.id, user_id: user.id, collection_id })),
              { onConflict: 'user_starred_repo_id,collection_id' }
            )
          )
        }
        await Promise.all(assignments)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Star error:', err)
    return NextResponse.json({ error: 'Failed to star repository' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(`${user.id}:star`, STAR_RATE_LIMIT, STAR_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many star/unstar requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      )
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
