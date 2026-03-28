import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Dashboard } from "@/components/dashboard"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <Dashboard user={user} />
}
