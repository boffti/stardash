import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRepoLatestRelease, type ReleaseInfo } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'

function isMajorReleaseTag(tagName: string): boolean {
  const normalized = tagName.trim().replace(/^release[-/]/i, '').replace(/^v/i, '')
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/)

  if (!match) return false

  const minor = match[2] ? Number(match[2]) : 0
  const patch = match[3] ? Number(match[3]) : 0
  return minor === 0 && patch === 0
}

// GET /api/github/health?repoIds=id1,id2,id3
// Returns health signals for the specified repos:
// - isTrending: based on star velocity (doubled in 30 days)
// - latestRelease: latest release info from GitHub

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Use getUser() instead of getSession() for security - validates token with Supabase Auth server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenResult = await getValidGitHubToken(user.id)
    const accessToken = tokenResult.token ?? undefined

    const { searchParams } = new URL(request.url)
    const repoIdsParam = searchParams.get('repoIds')

    if (!repoIdsParam) {
      return NextResponse.json({ error: 'repoIds parameter required' }, { status: 400 })
    }

    const repoIds = repoIdsParam.split(',').map(id => parseInt(id, 10)).filter(Boolean)

    if (repoIds.length === 0) {
      return NextResponse.json({ error: 'Invalid repoIds' }, { status: 400 })
    }

    // Fetch repos from starred_repos to get owner/name
    const { data: repos, error: reposError } = await supabase
      .from('starred_repos')
      .select('github_repo_id, owner, name, starred_at')
      .in('github_repo_id', repoIds)
      .eq('user_id', user.id)

    if (reposError) {
      throw reposError
    }

    // Get star snapshots for trending calculation
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('repo_star_snapshots')
      .select('repo_github_id, star_count, snapshot_date')
      .in('repo_github_id', repoIds)
      .gte('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (snapshotsError) {
      throw snapshotsError
    }

    // Calculate trending status for each repo
    const trendingMap = new Map<number, boolean>()

    // Group snapshots by repo
    const snapshotsByRepo = new Map<number, { count: number; date: string }[]>()
    for (const snapshot of snapshots || []) {
      if (!snapshotsByRepo.has(snapshot.repo_github_id)) {
        snapshotsByRepo.set(snapshot.repo_github_id, [])
      }
      snapshotsByRepo.get(snapshot.repo_github_id)!.push({
        count: snapshot.star_count,
        date: snapshot.snapshot_date,
      })
    }

    // Calculate if trending (doubled in 30 days)
    for (const [repoId, repoSnapshots] of snapshotsByRepo) {
      if (repoSnapshots.length >= 2) {
        const oldest = repoSnapshots[0]
        const newest = repoSnapshots[repoSnapshots.length - 1]

        // Check if doubled (and had at least 10 stars to avoid noise)
        if (oldest.count >= 10 && newest.count >= oldest.count * 2) {
          trendingMap.set(repoId, true)
        }
      }
    }

    // Fetch latest releases for each repo
    const releaseMap = new Map<number, Awaited<ReturnType<typeof fetchRepoLatestRelease>>>()

    // Process releases sequentially to avoid rate limits
    for (const repo of repos || []) {
      const release = await fetchRepoLatestRelease(repo.owner, repo.name, accessToken)
      if (release) {
        releaseMap.set(repo.github_repo_id, release)
      }
    }

    // Build response
    const result: Record<string, { isTrending: boolean; latestRelease: ReleaseInfo | null }> = {}

    for (const repo of repos || []) {
      const release = releaseMap.get(repo.github_repo_id)
      const hasNewRelease = Boolean(
        release &&
        !release.isPrerelease &&
        isMajorReleaseTag(release.tagName) &&
        repo.starred_at &&
        new Date(release.publishedAt) > new Date(repo.starred_at)
      )

      result[repo.github_repo_id] = {
        isTrending: trendingMap.get(repo.github_repo_id) || false,
        latestRelease: hasNewRelease ? (release ?? null) : null,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching repo health:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repo health' },
      { status: 500 }
    )
  }
}
