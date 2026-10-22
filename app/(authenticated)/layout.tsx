import { requireAuth } from "@/lib/auth"
import { UserProvider } from "@/components/providers/user-provider"

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return <UserProvider user={user}>{children}</UserProvider>
}
