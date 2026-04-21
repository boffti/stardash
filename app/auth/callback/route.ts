import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { GH_TOKEN_COOKIE, GH_TOKEN_MAX_AGE, storeGitHubOAuthToken } from '@/lib/tokens'

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
      const sessionWithProvider = data.session as typeof data.session & {
        provider_token_expires_in?: number
        provider_refresh_token?: string
        provider_refresh_token_expires_in?: number
      }
      const providerToken = sessionWithProvider.provider_token
      const providerRefreshToken = sessionWithProvider.provider_refresh_token
      const providerExpiresIn = sessionWithProvider.provider_token_expires_in
      const providerRefreshExpiresIn = sessionWithProvider.provider_refresh_token_expires_in
      
      if (providerToken && data.user) {
        const adminSupabase = createAdminClient()
        
        await adminSupabase.from('profiles').upsert({
          id: data.user.id,
          github_username: data.user.user_metadata?.user_name || data.user.user_metadata?.preferred_username,
          github_avatar_url: data.user.user_metadata?.avatar_url,
          github_id: data.user.user_metadata?.provider_id?.toString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

        await storeGitHubOAuthToken({
          userId: data.user.id,
          token: providerToken,
          refreshToken: providerRefreshToken,
          expiresIn: providerRefreshToken ? providerExpiresIn : undefined,
          refreshExpiresIn: providerRefreshExpiresIn,
        })
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
