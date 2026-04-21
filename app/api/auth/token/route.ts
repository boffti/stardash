import { createClient } from '@/lib/supabase/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getValidGitHubToken()
    
    if (result.error === 'not_found') {
      return NextResponse.json(
        { error: 'Token not found — please re-authenticate', code: 'TOKEN_NOT_FOUND' },
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
