'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import { reauthenticate, signOut } from '@/lib/auth'

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
