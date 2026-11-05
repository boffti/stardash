import { LoginContent } from "@/components/login-content"
import { getGitHubApp } from "@/lib/github-app"
import { safeNext } from "@/lib/safe-next"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next: rawNext, error } = await searchParams
  const next = safeNext(rawNext)
  const configured = Boolean(getGitHubApp())
  const connectHref = `/api/auth/github/${configured ? "start" : "setup"}?next=${encodeURIComponent(next)}`

  return (
    <LoginContent configured={configured} connectHref={connectHref} error={error} next={next} />
  )
}
