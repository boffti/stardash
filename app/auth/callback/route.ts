import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/'
  }

  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  const next = sanitizeNextPath(searchParams.get('next'))

  if (error_param) {
    return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(error_description || error_param)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      const providerToken = data.session.provider_token
      
      if (providerToken && data.user) {
        const adminSupabase = createAdminClient()
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 8)
        
        await adminSupabase.from('profiles').upsert({
          id: data.user.id,
          github_username: data.user.user_metadata?.user_name || data.user.user_metadata?.preferred_username,
          github_avatar_url: data.user.user_metadata?.avatar_url,
          github_id: data.user.user_metadata?.provider_id?.toString(),
          provider_token: providerToken,
          token_expires_at: expiresAt.toISOString(),
          last_token_refresh_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(error.message)}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
