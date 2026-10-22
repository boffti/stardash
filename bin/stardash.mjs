#!/usr/bin/env node
// StarDash CLI: agent tokens and MCP client config, straight against the SQLite file.
// Works from a checkout (DATABASE_PATH defaults to ./data/stardash.db) and inside the
// container: `docker exec stardash node bin/stardash.mjs token claude-code`.
import { DatabaseSync } from "node:sqlite"
import { createHash, randomBytes } from "node:crypto"

const [cmd = "help", ...rest] = process.argv.slice(2)
const path = process.env.DATABASE_PATH ?? "./data/stardash.db"
const url = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  "",
)

const open = () => {
  const db = new DatabaseSync(path)
  db.exec("pragma busy_timeout = 5000")
  return db
}
const owner = (db) => {
  const row = db.prepare("select id, github_username from profiles limit 1").get()
  if (!row) {
    console.error(`No one has signed in to this instance yet (${path}). Open ${url} first.`)
    process.exit(1)
  }
  return row
}
const config = (token) =>
  JSON.stringify(
    {
      mcpServers: {
        stardash: {
          type: "http",
          url: `${url}/api/mcp`,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  )

switch (cmd) {
  case "token": {
    const db = open()
    const { id: userId, github_username } = owner(db)
    const token = `sd_${randomBytes(24).toString("hex")}`
    const hash = createHash("sha256").update(token).digest("hex") // same as lib/api-tokens.ts
    db.prepare("insert into api_tokens (user_id, name, token_hash) values (?, ?, ?)").run(
      userId,
      rest[0] ?? "cli",
      hash,
    )
    console.log(`Token for @${github_username} (shown once):\n\n  ${token}\n\nMCP client config:\n`)
    console.log(config(token))
    break
  }
  case "tokens": {
    const db = open()
    const rows = db
      .prepare("select id, name, created_at, last_used_at from api_tokens order by created_at desc")
      .all()
    if (rows.length === 0) console.log("No tokens. Create one: stardash token <name>")
    for (const r of rows)
      console.log(
        `${r.id}  ${r.name.padEnd(16)}  created ${r.created_at.slice(0, 10)}  last used ${r.last_used_at?.slice(0, 10) ?? "never"}`,
      )
    break
  }
  case "revoke": {
    if (!rest[0]) {
      console.error("Usage: stardash revoke <id>")
      process.exit(1)
    }
    const n = open().prepare("delete from api_tokens where id = ?").run(rest[0]).changes
    console.log(n ? "Revoked." : "No token with that id.")
    break
  }
  case "mcp-config":
    console.log(config(rest[0] ?? "<token from `stardash token`>"))
    break
  default:
    console.log(`stardash <command>

  token [name]      Create a bearer token for MCP clients and print the client config
  tokens            List tokens
  revoke <id>       Revoke a token
  mcp-config [tok]  Print MCP client config for ${url}/api/mcp

Env: DATABASE_PATH (default ./data/stardash.db), APP_URL, PORT`)
}
