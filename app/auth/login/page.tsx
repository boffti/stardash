"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GitHubIcon } from "@/components/icons/github-icon"

const PAT_URL =
  "https://github.com/settings/tokens/new?description=StarDash&scopes=public_repo,read:user,read:org"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next")
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      setError(body.error ?? "Login failed.")
      setBusy(false)
      return
    }
    router.replace(safeNext)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <GitHubIcon className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Sign in to StarDash</CardTitle>
        <CardDescription>
          Paste a GitHub personal access token. It stays in this instance&apos;s database and is
          only used to read your stars.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
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
          <Button type="submit" className="w-full" disabled={busy || !token}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Continue
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No token yet?{" "}
            <a href={PAT_URL} target="_blank" rel="noreferrer" className="underline">
              Create one on GitHub
            </a>{" "}
            with <code>public_repo</code>, <code>read:user</code>, <code>read:org</code>.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
