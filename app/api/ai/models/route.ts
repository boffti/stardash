import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import type { AIProvider } from "@/lib/ai-provider"
import { aiErrorMessage } from "@/lib/ai-error"
import { listModelIds } from "@/lib/list-models"

const PROVIDERS = new Set<AIProvider>([
  "openrouter",
  "openai",
  "anthropic",
  "deepseek",
  "ollama",
  "compatible",
])

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const provider = request.headers.get("x-ai-provider") ?? ""
  if (!PROVIDERS.has(provider as AIProvider) || provider === "compatible") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }
  try {
    const models = await listModelIds(
      provider as AIProvider,
      request.headers.get("x-ai-key") ?? "",
      request.headers.get("x-ai-base-url") ?? undefined,
    )
    return NextResponse.json({ models })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 })
  }
}
