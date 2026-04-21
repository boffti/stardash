"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

const CHECK_COOLDOWN_MS = 5 * 60 * 1000

function reconnectUrl() {
  const next = `${window.location.pathname}${window.location.search}`
  return `/auth/login?reauth=github&next=${encodeURIComponent(next)}`
}

export function GitHubTokenRefresher() {
  const lastCheckedAtRef = useRef(0)
  const notifiedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const checkToken = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastCheckedAtRef.current < CHECK_COOLDOWN_MS) return
      lastCheckedAtRef.current = now

      try {
        const response = await fetch("/api/auth/token", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })

        if (cancelled) return

        if (response.ok) {
          notifiedRef.current = false
          return
        }

        const data = await response.json().catch(() => null)
        if (data?.code !== "GITHUB_REAUTH_REQUIRED" || notifiedRef.current) return

        notifiedRef.current = true
        toast.warning("GitHub access needs reconnecting", {
          description: "Reconnect once to restore authenticated GitHub API calls.",
          action: {
            label: "Reconnect",
            onClick: () => {
              window.location.href = reconnectUrl()
            },
          },
          duration: 10000,
        })
      } catch {
        // Background repair is opportunistic; API calls still handle auth failures.
      }
    }

    const handleFocus = () => void checkToken()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkToken()
    }

    void checkToken(true)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
