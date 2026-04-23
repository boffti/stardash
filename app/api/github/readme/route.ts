import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchRepoReadme } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

// Only uncached (first-time) README fetches count toward this limit.
// 50 live GitHub fetches per user per hour is generous for manual browsing
// but prevents a user with 5,000 repos from triggering 5,000 API calls in a burst.
const README_RATE_LIMIT = 50
const README_RATE_WINDOW_MS = 60 * 60_000 // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const owner = searchParams.get('owner')
    const repo = searchParams.get('repo')

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const adminSupabase = createAdminClient()
    const fullName = `${owner}/${repo}`
    const { data: cachedUserRepo, error: cachedUserRepoError } = await adminSupabase
      .from('user_starred_repos')
      .select('repos!inner(readme)')
      .eq('user_id', user.id)
      .eq('repos.full_name', fullName)
      .maybeSingle()

    if (cachedUserRepoError) {
      console.error('[github/readme] cache lookup failed:', cachedUserRepoError)
    }

    const cachedRepo = Array.isArray(cachedUserRepo?.repos)
      ? cachedUserRepo.repos[0]
      : cachedUserRepo?.repos

    if (cachedRepo?.readme) {
      return NextResponse.json({ readme: cachedRepo.readme })
    }

    // Cache miss — this will hit the GitHub API. Apply per-user rate limit.
    const rl = checkRateLimit(`${user.id}:readme`, README_RATE_LIMIT, README_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { readme: null, error: 'README fetch limit reached. Try again later.' },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const tokenResult = await getValidGitHubToken()

    if (tokenResult.error === 'expired') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 },
      )
    }

    const result = await fetchRepoReadme(tokenResult.token ?? undefined, owner, repo)

    if (result.error === 'auth') {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 },
      )
    }

    if (result.content) {
      const { error: updateError } = await adminSupabase
        .from('repos')
        .update({ readme: result.content })
        .eq('full_name', fullName)

      if (updateError) {
        console.error('[github/readme] cache update failed:', updateError)
      }
    }

    return NextResponse.json(
      { readme: result.content, error: result.error === 'server' ? 'Failed to fetch README' : undefined },
      { headers: getRateLimitHeaders(rl) },
    )
  } catch (error) {
    console.error('[github/readme] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch README' },
      { status: 500 },
    )
  }
}
