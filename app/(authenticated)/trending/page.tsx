import { TrendingDashboard } from "@/components/trending-dashboard"
import { requireAuth } from "@/lib/auth"

export default async function TrendingPage() {
  const user = await requireAuth()
  return <TrendingDashboard user={user} />
}
