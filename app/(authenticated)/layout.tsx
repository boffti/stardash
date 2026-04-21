import { requireAuth } from '@/lib/auth'
import { GitHubTokenRefresher } from '@/components/github-token-refresher'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <>
      <GitHubTokenRefresher />
      {children}
    </>
  )
}
