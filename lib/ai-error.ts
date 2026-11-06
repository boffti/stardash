type Issue = { path?: Array<string | number>; message?: string }

function firstLine(value: string) {
  const line = value
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-…")
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part && part !== "[" && part !== "]")
  return (line || "AI request failed").slice(0, 240)
}

function issuesOf(value: unknown): Issue[] {
  if (!value || typeof value !== "object") return []
  const record = value as { issues?: Issue[]; cause?: unknown }
  if (Array.isArray(record.issues)) return record.issues
  return issuesOf(record.cause)
}

function issueText(err: unknown) {
  const issue = issuesOf(err)[0]
  if (!issue?.message) return ""
  const path = issue.path?.length ? issue.path.join(".") : ""
  return path ? `${path}: ${issue.message}` : issue.message
}

function messageFromBody(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string }
    if (typeof parsed.error === "string") return parsed.error
    if (parsed.error && typeof parsed.error.message === "string") return parsed.error.message
    if (typeof parsed.message === "string") return parsed.message
  } catch {
    return ""
  }
  return ""
}

export function aiErrorMessage(err: unknown): string {
  const seen = new Set<unknown>()
  let current: unknown = err
  let fallback = "AI request failed"
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      message?: string
      text?: string
      responseBody?: string
      data?: { error?: { message?: string } }
      cause?: unknown
    }
    const issue = issueText(record)
    if (issue) return firstLine(issue)
    const fromData = record.data?.error?.message
    if (fromData) return firstLine(fromData)
    if (typeof record.responseBody === "string") {
      const fromBody = messageFromBody(record.responseBody)
      if (fromBody) return firstLine(fromBody)
    }
    if (typeof record.message === "string" && !record.message.trim().startsWith("[")) {
      fallback = record.message
    }
    if (typeof record.text === "string" && record.text.trim()) {
      return firstLine(`${fallback} ${record.text.trim()}`)
    }
    current = record.cause
  }
  return firstLine(fallback)
}
