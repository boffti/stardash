import { RepoIntelPage } from "@/components/repo-intel-page"

interface Props {
  params: Promise<{ owner: string; repo: string }>
}

export async function generateMetadata({ params }: Props) {
  const { owner, repo } = await params
  return { title: `${owner}/${repo} Health · Stellan` }
}

export default async function HealthDetailPage({ params }: Props) {
  const { owner, repo } = await params
  return <RepoIntelPage owner={owner} repo={repo} />
}
