"use client"

import { useI18n } from "@/components/i18n-provider"
import { useState } from "react"
import useSWR from "swr"
import { Copy, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TokenRow {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

/** Settings card: mint and revoke bearer tokens for MCP clients and the CLI. */
export function AgentTokens() {
  const { t, locale } = useI18n()
  const copy = (value: string) =>
    navigator.clipboard.writeText(value).then(
      () => toast.success(t("Copied", "已复制")),
      () => toast.error(t("Could not copy", "复制失败")),
    )
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
    if (!r.ok) return void toast.error(t("Could not create token", "无法创建令牌"))
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
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t("Agents (MCP)", "智能体（MCP）")}</h2>
      <div className="space-y-4">
        <form onSubmit={create} className="flex gap-2">
          <Input
            aria-label={t("Token name", "令牌名称")}
            placeholder={t("Token name", "令牌名称")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("New token", "新建令牌")}
          </Button>
        </form>

        {config && (
          <div className="space-y-2 rounded-xl bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              {t(
                "Copy before leaving. This token is shown once.",
                "离开前请复制，令牌仅显示一次。",
              )}
            </p>
            <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs">
              {config}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(config)}>
                <Copy className="h-3.5 w-3.5" /> {t("Copy config", "复制配置")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => fresh && copy(fresh)}>
                <Copy className="h-3.5 w-3.5" /> {t("Copy token only", "仅复制令牌")}
              </Button>
            </div>
          </div>
        )}

        {tokens && tokens.length > 0 && (
          <ul className="divide-y divide-border/40 rounded-xl bg-muted/20">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{token.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Created", "创建于")} {new Date(token.created_at).toLocaleDateString(locale)}
                    {token.last_used_at
                      ? t(
                          `, last used ${new Date(token.last_used_at).toLocaleDateString(locale)}`,
                          `，上次使用 ${new Date(token.last_used_at).toLocaleDateString(locale)}`,
                        )
                      : t(", never used", "，从未使用")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t(`Revoke ${token.name}`, `撤销 ${token.name}`)}
                  onClick={() => revoke(token.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
