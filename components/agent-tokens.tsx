"use client"

import { useState } from "react"
import useSWR from "swr"
import { Bot, Copy, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface TokenRow {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

const copy = (value: string) =>
  navigator.clipboard.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy"),
  )

/** Settings card: mint and revoke bearer tokens for MCP clients and the CLI. */
export function AgentTokens() {
  const { data, mutate } = useSWR<{ tokens: TokenRow[] }>("/api/tokens", (url: string) =>
    fetch(url).then((r) => r.json()),
  )
  const tokens = data?.tokens ?? null
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const mcpUrl = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp`

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "agent" }),
    })
    setBusy(false)
    if (!r.ok) return void toast.error("Could not create token")
    const { token } = (await r.json()) as { token: string }
    setFresh(token)
    setName("")
    void mutate()
  }

  async function revoke(id: string) {
    await fetch("/api/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    void mutate()
  }

  const config = fresh
    ? JSON.stringify(
        {
          mcpServers: {
            stardash: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${fresh}` } },
          },
        },
        null,
        2,
      )
    : null

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Agents (MCP)
        </CardTitle>
        <CardDescription>
          Let Claude Code, Cursor or any MCP client search, organize and triage your stars. Tokens
          are shown once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={create} className="flex gap-2">
          <Input
            placeholder="Token name, e.g. claude-code"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New token
          </Button>
        </form>

        {config && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Copy this now. Paste into <code>.mcp.json</code> (Claude Code) or your client&apos;s
              MCP settings.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs">
              {config}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(config)}>
                <Copy className="h-3.5 w-3.5" /> Copy config
              </Button>
              <Button size="sm" variant="ghost" onClick={() => fresh && copy(fresh)}>
                <Copy className="h-3.5 w-3.5" /> Copy token only
              </Button>
            </div>
          </div>
        )}

        {tokens && tokens.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(t.created_at).toLocaleDateString()}
                    {t.last_used_at
                      ? `, last used ${new Date(t.last_used_at).toLocaleDateString()}`
                      : ", never used"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Revoke ${t.name}`}
                  onClick={() => revoke(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
