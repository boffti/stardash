import { createClient } from '@/lib/supabase/server'
import { getValidGitHubToken, isTokenExpiringSoon } from '@/lib/tokens'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const result = await getValidGitHubToken(session.user.id)
    
    if (result.error === 'expired') {
      return NextResponse.json(
        { error: 'Token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }
    
    if (result.error === 'not_found') {
      return NextResponse.json(
        { error: 'No token available', code: 'TOKEN_NOT_FOUND' },
        { status: 401 }
      )
    }
    
    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to get token' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ valid: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to check token' },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const providerToken = session.provider_token
    
    if (!providerToken) {
      return NextResponse.json(
        { error: 'No provider token in session', code: 'NO_PROVIDER_TOKEN' },
        { status: 401 }
      )
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('token_expires_at')
      .eq('id', session.user.id)
      .single()
    
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8)
    
    await supabase
      .from('profiles')
      .update({
        provider_token: providerToken,
        token_expires_at: expiresAt.toISOString(),
        last_token_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
    
    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() })
  } catch {
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}
