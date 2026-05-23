'use client'

import { createContext, useContext, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { reauthenticate, signOut } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

interface UserContextValue {
  user: User
  signOut: () => Promise<void>
  reauthenticate: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  useEffect(() => {
    const supabase = createClient()

    // 1. React to auth state changes emitted by Supabase's client
    //    - TOKEN_REFRESHED: silently keeps the session alive, no action needed
    //    - SIGNED_OUT: session is gone — redirect to login immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        reauthenticate()
      }
    })

    // 2. When the user returns to the tab after being away, proactively check
    //    the session. Supabase will silently refresh it if the refresh token is
    //    still valid, or return null if it has fully expired, in which case we
    //    redirect to login rather than showing an empty/broken dashboard.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        reauthenticate()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, signOut, reauthenticate }}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Access the authenticated user and sign-out action from any client component
 * inside the (authenticated) layout. Never returns null — the layout guarantees
 * the user is present before this provider is rendered.
 */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser must be used inside UserProvider (authenticated layout)')
  }
  return ctx
}
