import { requireAuth } from '@/lib/auth'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return <>{children}</>
}
