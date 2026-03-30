"use client"

import { TrendingUp, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface TrendingEmptyStateProps {
  currentCount: number
  requiredCount: number
}

export function TrendingEmptyState({ currentCount, requiredCount }: TrendingEmptyStateProps) {
  const remaining = requiredCount - currentCount

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Need More Stars</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        To generate personalized trending recommendations, we need to analyze your last {requiredCount} starred repositories. You currently have {currentCount} stars.
      </p>

      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min((currentCount / requiredCount) * 100, 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {remaining} more {remaining === 1 ? "repository" : "repositories"} to go
        </p>

        <Link href="/">
          <Button className="mt-4">
            <Star className="h-4 w-4 mr-2" />
            Explore Your Stars
          </Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        Tip: Star repositories on GitHub that interest you, and we&apos;ll find similar trending repos.
      </p>
    </div>
  )
}
