import { ContributionDashboard } from "@/components/contribution-dashboard"
import { requireAuth } from "@/lib/auth"

export default async function ContributePage() {
  const user = await requireAuth()
  return <ContributionDashboard user={user} />
}
