import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { GH_TOKEN_COOKIE, GH_TOKEN_MAX_AGE } from '@/lib/tokens'

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
        
        // Store profile metadata only — token goes in a secure httpOnly cookie, not the DB
        await adminSupabase.from('profiles').upsert({
          id: data.user.id,
          github_username: data.user.user_metadata?.user_name || data.user.user_metadata?.preferred_username,
          github_avatar_url: data.user.user_metadata?.avatar_url,
          github_id: data.user.user_metadata?.provider_id?.toString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      let redirectUrl: string
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`
      } else {
        redirectUrl = `${origin}${next}`
      }

      const response = NextResponse.redirect(redirectUrl)

      if (providerToken) {
        response.cookies.set(GH_TOKEN_COOKIE, providerToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'lax',
          maxAge: GH_TOKEN_MAX_AGE,
          path: '/',
        })
      }

      return response
    }
    
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(error.message)}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
