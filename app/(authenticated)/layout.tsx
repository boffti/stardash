import { requireAuth } from "@/lib/auth"
import { UserProvider } from "@/components/providers/user-provider"
import { CommandPaletteProvider } from "@/components/command-palette"

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return (
    <UserProvider user={user}>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </UserProvider>
  )
}
