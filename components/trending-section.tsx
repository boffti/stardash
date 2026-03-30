"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepoCard } from "./repo-card"
import type { StarredRepo } from "@/lib/types"

interface TrendingSectionProps {
  title: string
  description: string
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
}

export function TrendingSection({ title, description, repos, onRepoClick }: TrendingSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -400 : 400
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  if (repos.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {repos.map((repo) => (
          <div
            key={repo.id}
            className="w-[320px] flex-shrink-0"
          >
            <RepoCard repo={repo} onClick={() => onRepoClick(repo)} />
          </div>
        ))}
      </div>
    </section>
  )
}
