import { Dashboard } from "@/components/dashboard"
import { requireAuth } from "@/lib/auth"

export default async function DashboardPage() {
  const user = await requireAuth()
  return <Dashboard user={user} />
}
