import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RecentlyViewedDashboard } from "@/components/recently-viewed-dashboard"

export default async function RecentlyViewedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <RecentlyViewedDashboard user={user} />
}
