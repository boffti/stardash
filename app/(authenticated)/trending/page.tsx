import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TrendingDashboard } from "@/components/trending-dashboard"

export default async function TrendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <TrendingDashboard user={user} />
}
