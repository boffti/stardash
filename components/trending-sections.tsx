"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Loader2 } from "lucide-react"
import { TrendingSection } from "@/components/trending-section"
import { TrendingEmptyState } from "@/components/trending-empty-state"
import { useUser } from "@/components/providers/user-provider"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { analyzeTrending } from "@/lib/trending"
import { trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { StarredRepo, UserMetadata } from "@/lib/types"

const MIN_STARS = 25

/** "From your stars": recommendations mined from the user's own recent stars. Lives inside Radar. */
export function TrendingSections() {
  const router = useRouter()
  const { user } = useUser()
  const { data, isLoading } = useStarredRepos(user?.id)
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  )

  const repos = useMemo(
    () =>
      (data?.repos ?? []).map((repo) => {
        const m = metadata?.repoMeta[repo.id]
        return m ? { ...repo, status: m.status ?? repo.status, notes: m.notes ?? repo.notes } : repo
      }),
    [data?.repos, metadata],
  )
  const analysis = useMemo(() => analyzeTrending(repos), [repos])

  const open = (repo: StarredRepo) => {
    if (user?.id) trackRecentlyViewedRepo(user.id, repo, "trending")
    router.push(`/repo/${repo.owner}/${repo.name}`)
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Reading your stars…
      </div>
    )
  }
  if (repos.length < MIN_STARS) {
    return <TrendingEmptyState currentCount={repos.length} requiredCount={MIN_STARS} />
  }

  return (
    <div className="space-y-6">
      {(analysis.topLanguages.length > 0 || analysis.topTopics.length > 0) && (
        <p className="text-sm text-muted-foreground">
          From your last {analysis.totalAnalyzed} stars:{" "}
          {analysis.topLanguages.slice(0, 3).join(", ")}
          {analysis.topTopics.length > 0 && ` · ${analysis.topTopics.slice(0, 3).join(", ")}`}
        </p>
      )}
      {analysis.categories.map((c) => (
        <TrendingSection
          key={c.id}
          title={c.title}
          description={c.description}
          repos={c.repos}
          onRepoClick={open}
        />
      ))}
      {analysis.categories.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nothing stands out yet. Star a few more repos and come back.
        </p>
      )}
    </div>
  )
}
