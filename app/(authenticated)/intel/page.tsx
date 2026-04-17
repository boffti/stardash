import { IntelDashboard } from "@/components/intel-dashboard"
import { requireAuth } from "@/lib/auth"

export default async function IntelPage() {
  const user = await requireAuth()
  return <IntelDashboard user={user} />
}
