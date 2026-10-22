"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GitHubIcon } from "@/components/icons/github-icon"

export function LandingAuthButtons() {
  return (
    <Button
      asChild
      className="ml-2 border border-black/10 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      <Link href="/auth/login">
        <GitHubIcon className="h-4 w-4" />
        Sign in with GitHub
      </Link>
    </Button>
  )
}
