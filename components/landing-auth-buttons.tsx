'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { GitHubIcon } from '@/components/icons/github-icon'

export function LandingAuthButtons() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGitHubLogin = async () => {
    if (isLoading) return
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'read:user user:email public_repo read:org notifications',
      },
    })
    // OAuth redirect takes over; reset in case it fails
    setIsLoading(false)
  }

  return (
    <Button
      onClick={handleGitHubLogin}
      disabled={isLoading}
      className="ml-2 border border-black/10 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <GitHubIcon className="h-4 w-4" />
          Sign in with GitHub
        </>
      )}
    </Button>
  )
}
