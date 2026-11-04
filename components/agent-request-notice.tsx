"use client"

import { AlertCircle, Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Shown when an AI feature ran without a key and went to the user's own agent
// (lib/agent-requests.ts). The route reports the request; the page polls until it lands.
export interface AgentRequestState {
  request?: { status: "queued" | "claimed" | "done" | "failed"; error: string | null }
  agent?: { watching: boolean }
}

export const isAgentPending = (d?: AgentRequestState) =>
  d?.request?.status === "queued" || d?.request?.status === "claimed"

/** SWR refreshInterval: poll every 3s while the agent has the request. */
export const agentPollInterval = (d?: AgentRequestState) => (isAgentPending(d) ? 3000 : 0)

export function AgentRequestNotice({
  state,
  className,
}: {
  state?: AgentRequestState
  className?: string
}) {
  const r = state?.request
  if (!r || r.status === "done") return null

  if (r.status === "failed") {
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive",
          className,
        )}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Your agent could not finish this. {r.error}</span>
      </div>
    )
  }

  const working = r.status === "claimed"
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm",
        className,
      )}
    >
      {working ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {working ? "Your agent is working on this." : "Queued for your agent."}
        </span>
        {!working && !state?.agent?.watching && (
          <span className="text-muted-foreground">
            No agent is connected. Connect the StarDash MCP server in Claude Code or Codex and run
            its stardash-agent prompt, or set an AI key in Settings.
          </span>
        )}
      </div>
    </div>
  )
}
