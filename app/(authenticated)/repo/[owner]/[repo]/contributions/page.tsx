import { RepoContributionsPage } from "@/components/repo-contributions-page"

interface RepoContributionsRouteProps {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoContributionsRoute({ params }: RepoContributionsRouteProps) {
  const { owner, repo } = await params
  return <RepoContributionsPage owner={owner} repo={repo} />
}
