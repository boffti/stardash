import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

export type AIProvider = "openrouter" | "openai" | "anthropic"

// Cheap, decent, good at structured output. A full categorize run over 500 repos
// is a few cents on any of these. AI_MODEL overrides the OpenRouter default.
const DEFAULT_MODELS: Record<AIProvider, string> = {
  openrouter: process.env.AI_MODEL || "anthropic/claude-haiku-5.5",
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-5-5",
}

export interface AIModelConfig {
  model: LanguageModel
  provider: AIProvider
  isUserKey: boolean
}

export function getProviderOptions(provider: AIProvider): Record<string, Record<string, string>> {
  if (provider === "anthropic") {
    // Anthropic's native outputFormat rejects minItems>1 and maxItems.
    // jsonTool mode uses tool-calling instead, which has no such restrictions.
    return { anthropic: { structuredOutputMode: "jsonTool" } }
  }
  return {}
}

export function getAIModel(request: Request): AIModelConfig {
  const headerKey = request.headers.get("x-ai-key")
  const headerProvider = (request.headers.get("x-ai-provider") ?? "openrouter") as AIProvider

  const isUserKey = !!headerKey
  const apiKey = headerKey ?? process.env.OPENROUTER_API_KEY ?? ""

  if (!apiKey) throw new Error("AI service not configured")

  const provider: AIProvider = isUserKey ? headerProvider : "openrouter"

  switch (provider) {
    case "openai":
      return { model: createOpenAI({ apiKey })(DEFAULT_MODELS.openai), provider, isUserKey }
    case "anthropic":
      return { model: createAnthropic({ apiKey })(DEFAULT_MODELS.anthropic), provider, isUserKey }
    default:
      return { model: createOpenRouter({ apiKey })(DEFAULT_MODELS.openrouter), provider, isUserKey }
  }
}
