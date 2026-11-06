import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

export type AIProvider =
  "openrouter" | "openai" | "anthropic" | "deepseek" | "ollama" | "compatible"

// Cheap, decent, good at structured output. A full categorize run over 500 repos
// is a few cents on any of these. AI_MODEL overrides the OpenRouter default.
const DEFAULT_MODELS: Record<Exclude<AIProvider, "compatible" | "ollama">, string> = {
  openrouter: process.env.AI_MODEL || "anthropic/claude-haiku-5.5",
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-5-5",
  deepseek: "deepseek-chat",
}

export interface AIModelConfig {
  model: LanguageModel
  provider: AIProvider
  isUserKey: boolean
}

export type ProviderOptions = Record<string, Record<string, string | boolean>>

export function getProviderOptions(provider: AIProvider): ProviderOptions {
  if (provider === "anthropic") {
    // Anthropic's native outputFormat rejects minItems>1 and maxItems.
    // jsonTool mode uses tool-calling instead, which has no such restrictions.
    return { anthropic: { structuredOutputMode: "jsonTool" } }
  }
  return {}
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text
      }
      return ""
    })
    .join("\n")
}

// Runs after the SDK converts messages into the chat-completions body.
// DeepSeek rejects json_object unless one of those messages contains "json".
function ensureDeepSeekJsonWord(body: Record<string, unknown>) {
  const messages = Array.isArray(body.messages) ? body.messages : []
  const hasJson = messages.some((message) => {
    if (!message || typeof message !== "object") return false
    return messageText((message as { content?: unknown }).content)
      .toLowerCase()
      .includes("json")
  })
  if (hasJson) return body
  return {
    ...body,
    messages: [{ role: "system", content: "Respond with a json object." }, ...messages],
  }
}

export function getAIModel(request: Request): AIModelConfig {
  const headerKey = request.headers.get("x-ai-key")
  const headerProvider = (request.headers.get("x-ai-provider") ?? "openrouter") as AIProvider

  const isUserKey = !!headerKey || headerProvider === "ollama"
  const modelId = request.headers.get("x-ai-model")?.trim()

  if (headerProvider === "ollama") {
    if (!modelId) throw new Error("AI service not configured: Ollama requires a model")
    const baseURL = request.headers.get("x-ai-base-url")?.trim() || "http://localhost:11434/v1"
    const url = new URL(baseURL)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error("AI service not configured: invalid Ollama URL")
    return {
      model: createOpenAICompatible({ name: "ollama", baseURL, apiKey: "ollama" })(modelId),
      provider: "ollama",
      isUserKey,
    }
  }

  // Server-side OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, llama.cpp...).
  // A key pasted in Settings still wins for that browser's requests.
  const baseURL = process.env.AI_BASE_URL
  if (!isUserKey && baseURL) {
    const modelId = process.env.AI_MODEL
    if (!modelId)
      throw new Error("AI service not configured: AI_MODEL is required with AI_BASE_URL")
    // .chat(): local servers speak /chat/completions, not OpenAI's Responses API.
    const model = createOpenAICompatible({
      name: "compatible",
      baseURL,
      apiKey: process.env.AI_API_KEY || "local",
    })(modelId)
    return { model, provider: "compatible", isUserKey }
  }

  const apiKey = headerKey ?? process.env.OPENROUTER_API_KEY ?? ""

  if (!apiKey) throw new Error("AI service not configured")

  const provider: AIProvider = isUserKey ? headerProvider : "openrouter"

  switch (provider) {
    case "openai":
      return {
        model: createOpenAI({ apiKey })(modelId || DEFAULT_MODELS.openai),
        provider,
        isUserKey,
      }
    case "anthropic":
      return {
        model: createAnthropic({ apiKey })(modelId || DEFAULT_MODELS.anthropic),
        provider,
        isUserKey,
      }
    case "deepseek":
      return {
        model: createOpenAICompatible({
          name: "deepseek",
          apiKey,
          baseURL: "https://api.deepseek.com/v1",
          // json_schema is rejected. Leave this off so the body uses json_object.
          supportsStructuredOutputs: false,
          transformRequestBody: ensureDeepSeekJsonWord,
        })(modelId || DEFAULT_MODELS.deepseek),
        provider,
        isUserKey,
      }
    default:
      return {
        model: createOpenRouter({ apiKey })(modelId || DEFAULT_MODELS.openrouter),
        provider: "openrouter",
        isUserKey,
      }
  }
}

/** True when an AI call can run: a user key in the headers, or a server key or endpoint. */
export const hasAIKey = (request: Request) =>
  !!(
    request.headers.get("x-ai-key") ||
    (request.headers.get("x-ai-provider") === "ollama" && request.headers.get("x-ai-model")) ||
    process.env.OPENROUTER_API_KEY ||
    (process.env.AI_BASE_URL && process.env.AI_MODEL)
  )
