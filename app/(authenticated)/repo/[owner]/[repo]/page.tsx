import { RepoDetailPage } from "@/components/repo-detail-page"

interface RepoPageProps {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { owner, repo } = await params
  return <RepoDetailPage owner={owner} repo={repo} />
}
