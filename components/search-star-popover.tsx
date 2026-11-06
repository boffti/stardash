"use client"

import { useState } from "react"
import { Star, Check, ChevronDown, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { chipHue } from "@/lib/more-color"
import { useI18n } from "@/components/i18n-provider"
import { toast } from "sonner"
import type { SearchRepo } from "@/app/api/search/repos/route"
import type { Tag, Collection } from "@/lib/types"

interface SearchStarPopoverProps {
  repo: SearchRepo
  tags: Tag[]
  collections: Collection[]
  onStarred?: (repo: SearchRepo) => void
}

export function SearchStarPopover({ repo, tags, collections, onStarred }: SearchStarPopoverProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [starred, setStarred] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set())

  const handleStar = async (skipOrganization = false) => {
    if (starred || loading) return
    setLoading(true)
    try {
      const response = await fetch("/api/github/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          githubRepoId: repo.id,
          tagIds: skipOrganization ? [] : Array.from(selectedTags),
          collectionIds: skipOrganization ? [] : Array.from(selectedCollections),
        }),
      })
      if (!response.ok) throw new Error("Failed to star repository")
      setStarred(true)
      setOpen(false)
      onStarred?.(repo)
    } catch {
      toast.error(t("Could not star repository. Try again.", "收藏失败，请重试。"))
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (starred) {
    return (
      <div className="flex items-center gap-1 text-xs text-emerald-500/80">
        <Check className="h-3.5 w-3.5" />
        <span>{t("Starred", "已收藏")}</span>
      </div>
    )
  }

  const hasTagsOrCollections = tags.length > 0 || collections.length > 0

  if (!hasTagsOrCollections) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => void handleStar()}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
        {t("Star", "收藏")}
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Star className="h-3 w-3" />
          {t("Star", "收藏")}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" sideOffset={6}>
        <div className="space-y-3">
          {collections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {t("Collections", "收藏夹")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {collections.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCollection(c.id)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all",
                      selectedCollections.has(c.id)
                        ? "border-accent/50 bg-accent/10 text-accent-foreground"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span>{c.emoji}</span>
                    <span className="truncate max-w-[80px]">{c.name}</span>
                    {selectedCollections.has(c.id) && <Check className="h-2.5 w-2.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {t("Tags", "标签")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 12).map((tag) => (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)}>
                    <Badge
                      variant="secondary"
                      data-hue={chipHue(tag.label)}
                      className={cn(
                        "h-5 cursor-pointer border-0 px-1.5 py-0 text-xs",
                        selectedTags.has(tag.id) ? "ring-1 ring-foreground/25" : "opacity-70",
                      )}
                    >
                      {tag.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => void handleStar()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Star className="h-3 w-3 mr-1" />
              )}
              {t("Star", "收藏")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setSelectedTags(new Set())
                setSelectedCollections(new Set())
                void handleStar(true)
              }}
              disabled={loading}
            >
              {t("Skip", "跳过")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
