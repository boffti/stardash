import { redirect } from "next/navigation"

// Trending lives inside Radar now ("From your stars" tab). Keep old links working.
export default function TrendingPage() {
  redirect("/radar?tab=stars")
}
