import { verifyApiToken } from "@/lib/api-tokens"
import { agentBus, listOpenRequests, watcherCount, type AgentEvent } from "@/lib/agent-requests"

// Event stream for agents that can run a background command (Claude Code's Monitor):
//   curl -sN -H "Authorization: Bearer $STARDASH_TOKEN" <url>/api/agent/events
// Replays queued work as "requested", then streams requested/claimed/done/failed.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const userId = verifyApiToken(bearer)
  if (!userId) return new Response("Unauthorized", { status: 401 })

  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: Omit<AgentEvent, "userId">) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
      for (const r of listOpenRequests(userId)) {
        send({ type: "requested", id: r.id, kind: r.kind, target: r.target })
      }
      const onEvent = ({ userId: owner, ...e }: AgentEvent) => {
        if (owner === userId) send(e)
      }
      // Comment lines keep proxies from closing an idle stream.
      const ping = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 25_000)
      agentBus.on("event", onEvent)
      watcherCount.add(1)
      cleanup = () => {
        clearInterval(ping)
        agentBus.off("event", onEvent)
        watcherCount.add(-1)
        cleanup = () => {}
      }
      request.signal.addEventListener("abort", () => {
        cleanup()
        try {
          controller.close()
        } catch {}
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  })
}
