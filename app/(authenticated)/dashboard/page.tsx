import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Dashboard } from "@/components/dashboard"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // The (authenticated) layout already checks for user, but we can keep it for safety.
  if (!user) {
    redirect("/auth/login")
  }

  return <Dashboard user={user} />
}
