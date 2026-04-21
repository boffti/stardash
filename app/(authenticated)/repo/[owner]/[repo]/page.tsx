import { requireAuth } from "@/lib/auth"
import { RepoDetailPage } from "@/components/repo-detail-page"

interface RepoPageProps {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoPage({ params }: RepoPageProps) {
  const [user, { owner, repo }] = await Promise.all([requireAuth(), params])
  return <RepoDetailPage user={user} owner={owner} repo={repo} />
}
