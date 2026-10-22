import { createHash, randomBytes } from "node:crypto"
import { db, nowIso } from "@/lib/db"

// Bearer tokens for agents (MCP) and the CLI. Only the sha256 is stored; the plain
// token is shown once at creation. Mirror of bin/stardash.mjs, keep the two in sync.
const hash = (token: string) => createHash("sha256").update(token).digest("hex")

export interface ApiTokenRow {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

export function createApiToken(userId: string, name: string) {
  const token = `sd_${randomBytes(24).toString("hex")}`
  const row = db
    .prepare("insert into api_tokens (user_id, name, token_hash) values (?, ?, ?) returning id")
    .get(userId, name.trim().slice(0, 60) || "token", hash(token)) as { id: string }
  return { id: row.id, token }
}

export const listApiTokens = (userId: string) =>
  db
    .prepare(
      "select id, name, created_at, last_used_at from api_tokens where user_id = ? order by created_at desc",
    )
    .all(userId) as unknown as ApiTokenRow[]

export const revokeApiToken = (userId: string, id: string) =>
  db.prepare("delete from api_tokens where id = ? and user_id = ?").run(id, userId).changes > 0

/** Resolves a bearer token to its owner, or null. Touches last_used_at. */
export function verifyApiToken(token: string | undefined | null): string | null {
  if (!token || !token.startsWith("sd_")) return null
  const row = db
    .prepare("update api_tokens set last_used_at = ? where token_hash = ? returning user_id")
    .get(nowIso(), hash(token)) as { user_id: string } | undefined
  return row?.user_id ?? null
}
