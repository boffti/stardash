"use client"

import { useI18n } from "@/components/i18n-provider"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PAT_URL =
  "https://github.com/settings/tokens/new?description=Stellan&scopes=public_repo,read:user,read:org"

export function PatLoginForm({ next }: { next: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("Paste a personal access token instead", "或粘贴个人访问令牌")}
      </button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(body.error ?? t("Login failed.", "登录失败。"))
      setBusy(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t pt-4">
      <Input
        type="password"
        autoComplete="off"
        placeholder="ghp_… or github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        required
      />
      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      <Button type="submit" variant="secondary" className="w-full" disabled={busy || !token}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("Sign in with token", "使用令牌登录")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <a href={PAT_URL} target="_blank" rel="noreferrer" className="underline">
          {t("Create a token", "创建令牌")}
        </a>{" "}
        {t("with", "并授予")} <code>public_repo</code>, <code>read:user</code>,{" "}
        <code>read:org</code>
        {t(".", "权限。")}
      </p>
    </form>
  )
}
