"use client"

import { useMemo, useRef } from "react"
import useSWR from "swr"
import { AlertCircle, Loader2, RotateCw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RepoCard } from "@/components/repo-card"
import { useAIKey } from "@/lib/use-ai-key"
import type { AskAnswer } from "@/lib/ask"
import type { StarredRepo } from "@/lib/types"

// All Stars in ask mode (/dashboard?ask=…): the answer, then the matching stars in
// rank order, each with the model's one-line reason.

const cacheKey = (userId: string, question: string) =>
  `stardash-ask-${userId}:${question.toLowerCase()}`

function readCache(key: string): AskAnswer | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as AskAnswer) : undefined
  } catch {
    return undefined
  }
}

export function AskResults({
  question,
  userId,
  repos,
  onRepoClick,
  onRemoveStar,
  onClear,
}: {
  question: string
  userId: string
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
  onRemoveStar?: (repo: StarredRepo) => void
  onClear: () => void
}) {
  const { getHeaders } = useAIKey()
  const key = cacheKey(userId, question)
  // A reload of the same question reads the saved answer instead of paying again;
  // "Ask again" skips it.
  const fresh = useRef(false)

  const { data, error, isLoading, isValidating, mutate } = useSWR<AskAnswer>(
    ["ask", key],
    async () => {
      if (!fresh.current) {
        const saved = readCache(key)
        if (saved) return saved
      }
      fresh.current = false
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ question }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Couldn't answer that. Try again.")
      try {
        localStorage.setItem(key, JSON.stringify(body))
      } catch {}
      return body as AskAnswer
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
    },
  )

  const matched = useMemo(() => {
    const byName = new Map(repos.map((r) => [r.fullName.toLowerCase(), r]))
    return (data?.repos ?? [])
      .map((m) => ({ repo: byName.get(m.fullName.toLowerCase()), reason: m.reason }))
      .filter((m): m is { repo: StarredRepo; reason: string } => Boolean(m.repo))
  }, [data?.repos, repos])

  const busy = isLoading || (isValidating && !data)

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium [overflow-wrap:anywhere]">{question}</p>
            {busy && (
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading your stars…
              </p>
            )}
            {!busy && error && (
              <p className="mt-1 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error.message}
              </p>
            )}
            {!busy && data && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{data.answer}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!busy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  fresh.current = true
                  void mutate()
                }}
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                aria-label="Ask again"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask again</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              aria-label="Clear question"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      </div>

      {busy && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {!busy && matched.length > 0 && (
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matched.map(({ repo, reason }, i) => (
            <li key={repo.id} className="flex min-w-0 flex-col gap-2">
              <p className="flex items-start gap-2 text-xs leading-snug text-foreground/80">
                <span className="mt-px shrink-0 font-mono tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="line-clamp-2" title={reason}>
                  {reason}
                </span>
              </p>
              <div className="flex-1 [&>*]:h-full">
                <RepoCard
                  repo={repo}
                  onClick={() => onRepoClick(repo)}
                  onRemoveStar={onRemoveStar}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
