import { SearchPage } from "@/components/search-page"
import { requireAuth } from "@/lib/auth"

export default async function SearchRoute() {
  const user = await requireAuth()
  return <SearchPage user={user} />
}
