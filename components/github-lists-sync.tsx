"use client"

import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { AlertCircle, ListChecks, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ListsSyncStatus } from "@/lib/github-lists"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** Settings card: two-way sync between collections and GitHub star lists. */
export function GitHubListsSync() {
  const { data, mutate } = useSWR<ListsSyncStatus>(
    "/api/github/lists",
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: (latest) => (latest?.state === "running" ? 2000 : 0) },
  )
  const running = data?.state === "running"

  async function start() {
    const r = await fetch("/api/github/lists", { method: "POST" })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      return void toast.error(body.error ?? "Could not start the sync")
    }
    void mutate(
      { ...(data as ListsSyncStatus), state: "running", done: 0, total: 0 },
      {
        revalidate: true,
      },
    )
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          GitHub Lists
        </CardTitle>
        <CardDescription>
          Keep your collections and your GitHub star lists in step, both ways. Lists StarDash
          creates are private. Deleting a collection or a list only unlinks it, the other side keeps
          its copy. After the first sync it also runs nightly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
          {running ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {data.total
                ? `Syncing ${data.done} of ${data.total} repos`
                : "Reading your lists and collections"}
            </span>
          ) : data?.state === "error" ? (
            <span className="flex items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="[overflow-wrap:anywhere]">Sync stopped: {data.error}</span>
            </span>
          ) : data?.state === "done" && data.finishedAt ? (
            <span>
              {plural(data.linked, "list")} linked, synced{" "}
              {formatDistanceToNow(new Date(data.finishedAt), { addSuffix: true })}.
              {data.createdLists + data.createdCollections > 0 &&
                ` Created ${plural(data.createdLists, "list")} and ${plural(data.createdCollections, "collection")}.`}
              {data.readOnly ? (
                <span className="mt-1 block">
                  Imported from GitHub only. GitHub does not let StarDash&apos;s app write lists, so
                  to push your collections up, set{" "}
                  <code className="font-mono text-xs">GITHUB_PAT</code> to a classic token with the{" "}
                  <code className="font-mono text-xs">user</code> scope and restart StarDash.
                </span>
              ) : (
                data.pending > 0 &&
                ` ${plural(data.pending, "repo")} left to write. GitHub allows about 500 writes an hour, so they finish on the next run.`
              )}
            </span>
          ) : (
            <span>Not synced yet.</span>
          )}
        </div>
        <Button
          onClick={start}
          disabled={running || !data}
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
        >
          <RefreshCw className={running ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {running ? "Syncing" : "Sync now"}
        </Button>
      </CardContent>
    </Card>
  )
}
