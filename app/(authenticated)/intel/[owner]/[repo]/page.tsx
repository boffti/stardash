import { redirect } from "next/navigation"

export default async function IntelDetailRedirect({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>
}) {
  const { owner, repo } = await params
  redirect(`/health/${owner}/${repo}`)
}
