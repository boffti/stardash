import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsPage } from "@/components/settings-page"

export default async function SettingsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <SettingsPage user={user} />
}
