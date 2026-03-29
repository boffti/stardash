'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { Github, RefreshCw, Settings, Moon, Sun, Monitor, LogOut, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface UserMenuProps {
  user: SupabaseUser | null
  lastSynced?: string | null
}

export function UserMenu({ user, lastSynced }: UserMenuProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const username = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url
  const githubUrl = user?.user_metadata?.user_name 
    ? `https://github.com/${user.user_metadata.user_name}` 
    : 'https://github.com'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={username} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{username}</p>
          <p className="text-xs text-muted-foreground">@{username}</p>
          {lastSynced && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              {lastSynced}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            <Github className="mr-2 h-4 w-4" />
            View GitHub
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Stars
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-6">Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
                {mounted && theme === 'light' && <span className="ml-auto text-accent">&#10003;</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
                {mounted && theme === 'dark' && <span className="ml-auto text-accent">&#10003;</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
                {mounted && theme === 'system' && <span className="ml-auto text-accent">&#10003;</span>}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
