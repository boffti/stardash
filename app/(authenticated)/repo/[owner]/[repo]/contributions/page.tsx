import { requireAuth } from "@/lib/auth"
import { RepoContributionsPage } from "@/components/repo-contributions-page"

interface RepoContributionsRouteProps {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoContributionsRoute({ params }: RepoContributionsRouteProps) {
  const [user, { owner, repo }] = await Promise.all([requireAuth(), params])
  return <RepoContributionsPage user={user} owner={owner} repo={repo} />
}
