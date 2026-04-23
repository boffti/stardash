import { requireAuth } from '@/lib/auth'
import { GitHubTokenRefresher } from '@/components/github-token-refresher'
import { UserProvider } from '@/components/providers/user-provider'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <UserProvider user={user}>
      <GitHubTokenRefresher />
      {children}
    </UserProvider>
  )
}
