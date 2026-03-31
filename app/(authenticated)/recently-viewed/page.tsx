import { RecentlyViewedDashboard } from "@/components/recently-viewed-dashboard"
import { requireAuth } from "@/lib/auth"

export default async function RecentlyViewedPage() {
  const user = await requireAuth()
  return <RecentlyViewedDashboard user={user} />
}
