"use server"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { SESSION_COOKIE, verifySession } from "@/lib/session"

export interface User {
  id: string
  login: string
  avatarUrl: string | null
}

export const getUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies()
  const id = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!id) return null
  const row = db
    .prepare("select id, github_username, github_avatar_url from profiles where id = ?")
    .get(id) as
    { id: string; github_username: string; github_avatar_url: string | null } | undefined
  return row ? { id: row.id, login: row.github_username, avatarUrl: row.github_avatar_url } : null
})

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) redirect("/auth/login")
  return user
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect("/")
}

export async function reauthenticate() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect("/auth/login")
}
