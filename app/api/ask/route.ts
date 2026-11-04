import { NextResponse } from "next/server"
import { after } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { askStars } from "@/lib/ask"
import { getAIModel, getProviderOptions, type AIModelConfig } from "@/lib/ai-provider"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { langfuseSpanProcessor } from "@/instrumentation"

export const maxDuration = 60

// ponytail: in-memory per-instance limiter, like Radar's scan.
const ASK_LIMIT = 30
const ASK_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { question } = (await request.json().catch(() => ({}))) as { question?: unknown }
    const q = typeof question === "string" ? question.trim().slice(0, 300) : ""
    if (q.length < 2) return NextResponse.json({ error: "Ask a question" }, { status: 400 })

    let modelConfig: AIModelConfig
    try {
      modelConfig = getAIModel(request)
    } catch {
      return NextResponse.json(
        { error: "Ask needs an AI key. Add one in Settings." },
        { status: 503 },
      )
    }

    const rl = checkRateLimit(`${user.id}:ask`, ASK_LIMIT, ASK_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "That's a lot of questions. Try again in a bit." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const answer = await askStars(
      user.id,
      q,
      modelConfig.model,
      getProviderOptions(modelConfig.provider),
    )
    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })
    return NextResponse.json(answer, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    console.error("[ask] error:", err)
    return NextResponse.json({ error: "Couldn't answer that. Try again." }, { status: 500 })
  }
}
