"use client"

import {
  Check,
  Code2,
  Loader2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type {
  SearchPipelineEvent,
  SearchPipelineStatus,
  SearchPipelineStepId,
  SearchPipelineStepEvent,
} from "@/app/api/search/repos/route"

const PIPELINE_STEPS: Array<{
  id: SearchPipelineStepId
  title: string
  description: string
}> = [
  {
    id: "auth",
    title: "Session",
    description: "Validate app session and choose GitHub access mode.",
  },
  {
    id: "expand",
    title: "Intent expansion",
    description: "Generate targeted GitHub search operators.",
  },
  {
    id: "github",
    title: "GitHub retrieval",
    description: "Fetch public repository candidates in parallel.",
  },
  {
    id: "dedupe",
    title: "Candidate merge",
    description: "Remove duplicate repos across expanded searches.",
  },
  {
    id: "rerank",
    title: "AI rerank",
    description: "Score each repository and attach evidence notes.",
  },
  {
    id: "render",
    title: "Result shaping",
    description: "Sort and prepare the final result grid.",
  },
]

function formatElapsed(ms?: number) {
  if (typeof ms !== "number") return null
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getStepEvent(events: SearchPipelineEvent[], id: SearchPipelineStepId): SearchPipelineStepEvent | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event.type === "step" && event.id === id) return event
  }
  return undefined
}

function getStatusIndicator(status: SearchPipelineStatus, stepNumber: number) {
  if (status === "completed") return <Check className="h-3 w-3" />
  if (status === "error") return <X className="h-3 w-3" />

  return (
    <>
      {status === "running" && <Loader2 className="absolute inset-0 h-full w-full animate-spin p-1 text-primary/70" />}
      <span className="relative text-[11px] font-semibold tabular-nums leading-none">{stepNumber}</span>
    </>
  )
}

interface SearchPipelineTimelineProps {
  events: SearchPipelineEvent[]
  isSearching: boolean
  className?: string
}

export function SearchPipelineTimeline({ events, isSearching, className }: SearchPipelineTimelineProps) {
  if (events.length === 0 && !isSearching) return null

  const resultEvent = events.find((event) => event.type === "result")
  const errorEvent = events.find((event) => event.type === "error")
  const completedCount = PIPELINE_STEPS.filter(step => getStepEvent(events, step.id)?.status === "completed").length
  const activeStep = PIPELINE_STEPS.find(step => getStepEvent(events, step.id)?.status === "running")
  const progressValue = resultEvent ? 100 : Math.max(8, Math.round((completedCount / PIPELINE_STEPS.length) * 100))

  return (
    <div className={cn("rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">AI search pipeline</h3>
              <Badge variant={errorEvent ? "destructive" : resultEvent ? "secondary" : "outline"}>
                {errorEvent ? "Failed" : resultEvent ? "Complete" : activeStep ? activeStep.title : "Starting"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {errorEvent?.error ?? (resultEvent ? `${resultEvent.repos.length} repos ranked in ${formatElapsed(resultEvent.elapsedMs)}` : "Streaming backend progress as each stage completes.")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{progressValue}%</span>
          <div className="w-28">
            <Progress value={progressValue} className="h-1.5" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {PIPELINE_STEPS.map((step, index) => {
          const event = getStepEvent(events, step.id)
          const status = event?.status ?? "pending"
          const elapsed = formatElapsed(event?.elapsedMs)
          const stepNumber = index + 1

          return (
            <div key={step.id} className="relative flex items-center gap-3 rounded-md border border-border/60 bg-background/50 p-3">
              <div
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground",
                  status === "completed" && "border-primary bg-primary text-primary-foreground",
                  status === "running" && "border-primary text-primary",
                  status === "error" && "border-destructive bg-destructive text-destructive-foreground",
                )}
              >
                {getStatusIndicator(status, stepNumber)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-medium">{event?.title ?? step.title}</p>
                  {elapsed && <span className="shrink-0 text-[10px] text-muted-foreground">{elapsed}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {event?.detail ?? step.description}
                </p>
                {event?.meta && Object.keys(event.meta).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(event.meta).slice(0, 3).map(([key, value]) => (
                      <span key={key} className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
