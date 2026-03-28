'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Github, Star, ArrowRight } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGitHubLogin = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user',
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-8">
          {/* Logo and Title */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <Star className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">StarDash</h1>
              <p className="text-muted-foreground mt-1">Your GitHub Stars, Organized</p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">Sign in to continue</CardTitle>
              <CardDescription>
                Connect your GitHub account to organize and manage your starred repositories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGitHubLogin}
                disabled={isLoading}
                className="w-full h-12 text-base gap-3"
                size="lg"
              >
                <Github className="h-5 w-5" />
                {isLoading ? 'Connecting...' : 'Continue with GitHub'}
                {!isLoading && <ArrowRight className="h-4 w-4 ml-auto" />}
              </Button>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2">
                We only request read access to your public profile and starred repos.
              </p>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="space-y-1">
              <div className="font-medium">Organize</div>
              <div className="text-muted-foreground text-xs">Tags & Collections</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Search</div>
              <div className="text-muted-foreground text-xs">Find repos fast</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Track</div>
              <div className="text-muted-foreground text-xs">Usage status</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
