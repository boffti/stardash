import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRepoLatestRelease, type ReleaseInfo } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const adminSupabase = createAdminClient()

    // Use getUser() instead of getSession() for security - validates token with Supabase Auth server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenResult = await getValidGitHubToken()
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

    const { data: repoRows, error: repoRowsError } = await adminSupabase
      .from('repos')
      .select('id, github_repo_id, owner, name')
      .in('github_repo_id', repoIds)

    if (repoRowsError) {
      throw repoRowsError
    }

    const repoIdMap = new Map<string, { github_repo_id: number; owner: string; name: string }>()
    for (const repo of repoRows || []) {
      repoIdMap.set(repo.id, {
        github_repo_id: repo.github_repo_id,
        owner: repo.owner,
        name: repo.name,
      })
    }

    if ((repoRows?.length ?? 0) === 0) {
      return NextResponse.json({})
    }

    const { data: userStarredRepos, error: userStarredReposError } = await supabase
      .from('user_starred_repos')
      .select('repo_id, starred_at')
      .eq('user_id', user.id)
      .in('repo_id', Array.from(repoIdMap.keys()))

    if (userStarredReposError) {
      throw userStarredReposError
    }

    const repos: Array<{ github_repo_id: number; owner: string; name: string; starred_at: string | null }> = (userStarredRepos || [])
      .map((row) => {
        const repo = repoIdMap.get(row.repo_id)
        if (!repo) return null
        return {
          ...repo,
          starred_at: row.starred_at,
        }
      })
      .filter((row): row is { github_repo_id: number; owner: string; name: string; starred_at: string | null } => row !== null)

    // Get star snapshots for traction calculation
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('repo_star_snapshots')
      .select('repo_github_id, star_count, snapshot_date')
      .in('repo_github_id', repoIds)
      .gte('snapshot_date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (snapshotsError) {
      throw snapshotsError
    }

    type StarVelocityLabel = 'on-fire' | 'heating-up' | 'steady' | 'cooling'
    interface StarVelocity { growth7d: number; growth30d: number; growth90d: number; label: StarVelocityLabel }

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

    const trendingMap = new Map<number, boolean>()
    const velocityMap = new Map<number, StarVelocity>()

    for (const [repoId, repoSnapshots] of snapshotsByRepo) {
      if (repoSnapshots.length < 2) continue

      const oldest = repoSnapshots[0]
      const newest = repoSnapshots[repoSnapshots.length - 1]

      if (oldest.count < 10) continue

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const thirtyDaySnap = repoSnapshots
        .filter(s => new Date(s.date) <= thirtyDaysAgo)
        .at(-1)

      const growth30d = thirtyDaySnap ? newest.count - thirtyDaySnap.count : newest.count - oldest.count
      const growth90d = newest.count - oldest.count

      const sevenDaySnap = repoSnapshots
        .filter(s => new Date(s.date) <= sevenDaysAgo)
        .at(-1)

      let label: StarVelocityLabel = 'steady'

      if (sevenDaySnap) {
        const growth7d = newest.count - sevenDaySnap.count
        const daysInEarlierWindow = Math.max(
          1,
          (sevenDaysAgo.getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24)
        )
        const spd7 = growth7d / 7
        const spd8_30 = (sevenDaySnap.count - oldest.count) / daysInEarlierWindow

        if (spd8_30 > 0) {
          if (spd7 > spd8_30 * 3) label = 'on-fire'
          else if (spd7 > spd8_30 * 1.5) label = 'heating-up'
          else if (spd7 < spd8_30 * 0.5) label = 'cooling'
        } else if (growth7d > 10) {
          label = 'heating-up'
        }

        velocityMap.set(repoId, { growth7d, growth30d, growth90d, label })
      } else {
        velocityMap.set(repoId, { growth7d: 0, growth30d, growth90d, label: 'steady' })
      }

      trendingMap.set(repoId, label === 'on-fire' || label === 'heating-up')
    }

    // Fetch latest releases for each repo
    const releaseMap = new Map<number, Awaited<ReturnType<typeof fetchRepoLatestRelease>>>()

    // Process releases sequentially to avoid rate limits
    for (const repo of repos) {
      const release = await fetchRepoLatestRelease(repo.owner, repo.name, accessToken)
      if (release) {
        releaseMap.set(repo.github_repo_id, release)
      }
    }

    // Build response
    const result: Record<string, {
      isTrending: boolean
      latestRelease: ReleaseInfo | null
      starVelocity: StarVelocity | null
    }> = {}

    for (const repo of repos) {
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
        starVelocity: velocityMap.get(repo.github_repo_id) ?? null,
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
