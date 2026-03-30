import { createClient } from '@/lib/supabase/server'

export interface TokenResult {
  token: string | null
  error?: 'expired' | 'not_found' | 'server'
}

export async function getValidGitHubToken(userId: string): Promise<TokenResult> {
  const supabase = await createClient()
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('provider_token, token_expires_at')
      .eq('id', userId)
      .single()
    
    if (error || !profile) {
      return { token: null, error: 'not_found' }
    }
    
    if (!profile.provider_token) {
      return { token: null, error: 'not_found' }
    }
    
    const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at) : null
    const now = new Date()
    
    if (expiresAt && expiresAt < now) {
      return { token: null, error: 'expired' }
    }
    
    return { token: profile.provider_token }
  } catch {
    return { token: null, error: 'server' }
  }
}

export async function updateGitHubToken(
  userId: string, 
  token: string
): Promise<void> {
  const supabase = await createClient()
  
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 8)
  
  await supabase
    .from('profiles')
    .update({
      provider_token: token,
      token_expires_at: expiresAt.toISOString(),
      last_token_refresh_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

export async function clearGitHubToken(userId: string): Promise<void> {
  const supabase = await createClient()
  
  await supabase
    .from('profiles')
    .update({
      provider_token: null,
      token_expires_at: null,
      last_token_refresh_at: null,
    })
    .eq('id', userId)
}

export function isTokenExpiringSoon(
  expiresAt: string | null, 
  thresholdMinutes: number = 30
): boolean {
  if (!expiresAt) return false
  
  const expiry = new Date(expiresAt)
  const threshold = new Date()
  threshold.setMinutes(threshold.getMinutes() + thresholdMinutes)
  
  return expiry < threshold
}
