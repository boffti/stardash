import { SettingsPage } from "@/components/settings-page"
import { requireAuth } from "@/lib/auth"

export default async function SettingsRoute() {
  const user = await requireAuth()
  return <SettingsPage user={user} />
}
