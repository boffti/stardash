"use client"

import { createContext, useContext } from "react"
import { reauthenticate, signOut, type User } from "@/lib/auth"

interface UserContextValue {
  user: User
  signOut: () => Promise<void>
  reauthenticate: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <UserContext.Provider value={{ user, signOut, reauthenticate }}>
      {children}
    </UserContext.Provider>
  )
}

/** The signed-in user. Never null: the (authenticated) layout redirects before rendering this. */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used inside UserProvider (authenticated layout)")
  return ctx
}
