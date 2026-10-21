import { notFound } from "next/navigation"
import { RadarFeed } from "@/components/radar-feed"
import { RADAR_ENABLED } from "@/lib/flags"

export default function RadarPage() {
  if (!RADAR_ENABLED) notFound()
  return <RadarFeed />
}
