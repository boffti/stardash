'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GH_TOKEN_COOKIE } from '@/lib/tokens'

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
})

export async function getSession() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    return null
  }
  
  return session
}

export async function getUserProfile() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null
  }
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, github_username, github_avatar_url, github_id')
    .eq('id', user.id)
    .single()
  
  if (profileError) {
    // Profile might not exist yet, return basic user info
    return {
      id: user.id,
      email: user.email,
      github_username: user.user_metadata?.user_name || user.user_metadata?.preferred_username,
      github_avatar_url: user.user_metadata?.avatar_url,
      github_id: user.user_metadata?.provider_id,
    }
  }
  
  return profile
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(GH_TOKEN_COOKIE)
  redirect('/')
}

export async function reauthenticate() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(GH_TOKEN_COOKIE)
  redirect('/auth/login')
}

export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return user
}
