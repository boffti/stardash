import { EventEmitter } from "node:events"
import { zodSchema } from "ai"
import type { z } from "zod"
import { db, fromJson, nowIso, toJson } from "@/lib/db"
import {
  INTEL_SYSTEM,
  RepoIntelSchema,
  buildIntelPrompt,
  finishIntel,
  saveRepoInsight,
  type IntelInput,
} from "@/lib/ai-repo-intel"

// With no AI key configured, AI features queue a request here and the user's own
// agent (Claude Code, Codex, Cursor...) drains it over MCP: list, claim, do the work,
// complete with a result that must match the same zod schema the in-app path uses.

export type RequestStatus = "queued" | "claimed" | "done" | "failed"

export interface AgentRequest {
  id: string
  kind: string
  target: string | null
  status: RequestStatus
  error: string | null
  created_at: string
  claimed_at: string | null
  done_at: string | null
}

interface Kind<I, S extends z.ZodTypeAny> {
  schema: S
  /** What the agent needs: system prompt + task text, never raw secrets. */
  task: (input: I) => { system: string; prompt: string }
  save: (input: I, result: z.output<S>, userId: string) => void
}

const kind = <I, S extends z.ZodTypeAny>(k: Kind<I, S>) => k

const KINDS = {
  intel: kind({
    schema: RepoIntelSchema,
    task: (input: IntelInput) => ({ system: INTEL_SYSTEM, prompt: buildIntelPrompt(input) }),
    save: (input: IntelInput, result) => {
      saveRepoInsight(input.repoFullName, finishIntel(input, result))
    },
  }),
}
export type RequestKind = keyof typeof KINDS

// A claim older than this is treated as abandoned (agent crashed) and offered again.
const CLAIM_TTL_MS = 10 * 60 * 1000

// ponytail: in-process bus, fine for the single-container deploy. Needs a shared
// channel (sqlite poll or redis) if StarDash ever runs more than one process.
const g = globalThis as typeof globalThis & { __agentBus?: EventEmitter; __agentWatchers?: number }
export const agentBus = (g.__agentBus ??= new EventEmitter().setMaxListeners(100))
export const watcherCount = {
  get: () => g.__agentWatchers ?? 0,
  add: (n: number) => (g.__agentWatchers = Math.max(0, (g.__agentWatchers ?? 0) + n)),
}

export interface AgentEvent {
  type: "requested" | "claimed" | "done" | "failed"
  userId: string
  id: string
  kind: string
  target: string | null
}

const COLS = "id, kind, target, status, error, created_at, claimed_at, done_at"
const emit = (type: AgentEvent["type"], userId: string, r: AgentRequest) =>
  agentBus.emit("event", { type, userId, id: r.id, kind: r.kind, target: r.target } as AgentEvent)

export function queueRequest<K extends RequestKind>(
  userId: string,
  kind: K,
  target: string | null,
  input: Parameters<(typeof KINDS)[K]["task"]>[0],
): AgentRequest {
  const open = latestRequest(userId, kind, target)
  if (open && (open.status === "queued" || open.status === "claimed")) return open
  const row = db
    .prepare(
      `insert into agent_requests (user_id, kind, target, input) values (?, ?, ?, ?) returning ${COLS}`,
    )
    .get(userId, kind, target, toJson(input)) as unknown as AgentRequest
  emit("requested", userId, row)
  return row
}

export const latestRequest = (userId: string, kind: string, target: string | null) =>
  db
    .prepare(
      `select ${COLS} from agent_requests where user_id = ? and kind = ? and target is ?
       order by created_at desc limit 1`,
    )
    .get(userId, kind, target) as AgentRequest | undefined

/** Queued requests plus abandoned claims, oldest first. */
export function listOpenRequests(userId: string) {
  const stale = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
  const rows = db
    .prepare(
      `select ${COLS}, input from agent_requests
       where user_id = ? and (status = 'queued' or (status = 'claimed' and claimed_at < ?))
       order by created_at limit 20`,
    )
    .all(userId, stale) as unknown as (AgentRequest & { input: string })[]
  return rows.map(({ input, ...r }) => {
    const k = KINDS[r.kind as RequestKind]
    return {
      ...r,
      ...k.task(fromJson(input, {}) as never),
      resultSchema: zodSchema(k.schema).jsonSchema,
    }
  })
}

export function claimRequest(userId: string, id: string) {
  const stale = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
  const row = db
    .prepare(
      `update agent_requests set status = 'claimed', claimed_at = ?
       where id = ? and user_id = ? and (status = 'queued' or (status = 'claimed' and claimed_at < ?))
       returning ${COLS}`,
    )
    .get(nowIso(), id, userId, stale) as AgentRequest | undefined
  if (!row) return { error: "not found, or already claimed or finished" }
  emit("claimed", userId, row)
  return { ok: true, id }
}

export function completeRequest(userId: string, id: string, result: unknown) {
  const row = db
    .prepare(`select ${COLS}, input from agent_requests where id = ? and user_id = ?`)
    .get(id, userId) as (AgentRequest & { input: string }) | undefined
  if (!row) return { error: "request not found" }
  if (row.status === "done" || row.status === "failed") return { error: `already ${row.status}` }
  const k = KINDS[row.kind as RequestKind]
  const parsed = k.schema.safeParse(result)
  if (!parsed.success) {
    // Leave it claimed so the agent can fix the result and call complete again.
    return { error: "result does not match resultSchema", issues: parsed.error.issues }
  }
  k.save(fromJson(row.input, {}) as never, parsed.data, userId)
  const done = db
    .prepare(
      `update agent_requests set status = 'done', result = ?, done_at = ? where id = ? returning ${COLS}`,
    )
    .get(toJson(parsed.data), nowIso(), id) as unknown as AgentRequest
  emit("done", userId, done)
  return { ok: true, id }
}

export function failRequest(userId: string, id: string, reason: string) {
  const row = db
    .prepare(
      `update agent_requests set status = 'failed', error = ?, done_at = ?
       where id = ? and user_id = ? and status in ('queued', 'claimed') returning ${COLS}`,
    )
    .get(reason.slice(0, 500), nowIso(), id, userId) as AgentRequest | undefined
  if (!row) return { error: "not found or already finished" }
  emit("failed", userId, row)
  return { ok: true, id }
}

/** Long poll: resolves with open requests as soon as there are any, or [] at timeout. */
export function waitForRequests(userId: string, timeoutMs: number) {
  const now = listOpenRequests(userId)
  if (now.length) return Promise.resolve(now)
  return new Promise<ReturnType<typeof listOpenRequests>>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      agentBus.off("event", onEvent)
      resolve(listOpenRequests(userId))
    }
    const onEvent = (e: AgentEvent) => {
      if (e.userId === userId && e.type === "requested") finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    agentBus.on("event", onEvent)
  })
}

/** True while an agent holds the SSE stream open or called the MCP server in the last 2 minutes. */
export function agentWatching(userId: string) {
  if (watcherCount.get() > 0) return true
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  return !!db
    .prepare("select 1 from api_tokens where user_id = ? and last_used_at > ? limit 1")
    .get(userId, since)
}
