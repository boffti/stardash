import type { AIProvider } from "@/lib/ai-provider"

type ModelRow = { id?: string; name?: string }

function idsFrom(rows: ModelRow[] | undefined) {
  return [...new Set((rows ?? []).map((row) => row.id || row.name || "").filter(Boolean))].sort()
}

async function readFailure(response: Response) {
  const body = await response.text()
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string }
    if (typeof parsed.error === "string") return parsed.error
    if (parsed.error?.message) return parsed.error.message
  } catch {
    return body.slice(0, 180) || `Model list failed (${response.status})`
  }
  return `Model list failed (${response.status})`
}

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, cache: "no-store" })
  if (!response.ok) throw new Error(await readFailure(response))
  return response.json() as Promise<{ data?: ModelRow[]; models?: ModelRow[] }>
}

export async function listModelIds(provider: AIProvider, apiKey: string, baseURL?: string) {
  if (provider === "ollama") {
    const root = (baseURL || "http://localhost:11434/v1").replace(/\/v1\/?$/, "")
    const body = await getJson(`${root}/api/tags`, {})
    return idsFrom(body.models)
  }
  if (!apiKey) throw new Error("Add an API key first")
  if (provider === "anthropic") {
    const body = await getJson("https://api.anthropic.com/v1/models", {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    })
    return idsFrom(body.data)
  }
  if (provider === "openrouter") {
    const body = await getJson("https://openrouter.ai/api/v1/models", {
      Authorization: `Bearer ${apiKey}`,
    })
    return idsFrom(body.data)
  }
  if (provider === "deepseek") {
    const body = await getJson("https://api.deepseek.com/models", {
      Authorization: `Bearer ${apiKey}`,
    })
    return idsFrom(body.data)
  }
  const body = await getJson("https://api.openai.com/v1/models", {
    Authorization: `Bearer ${apiKey}`,
  })
  return idsFrom(body.data)
}
