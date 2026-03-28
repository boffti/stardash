import { createClient } from '@/lib/supabase/server'
import { fetchAllStarredRepos } from '@/lib/github'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get the current session with provider token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const providerToken = session.provider_token
    
    if (!providerToken) {
      return NextResponse.json(
        { error: 'GitHub token not available. Please re-authenticate.' },
        { status: 401 }
      )
    }

    const repos = await fetchAllStarredRepos(providerToken)

    return NextResponse.json({ repos, lastSynced: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch starred repos' },
      { status: 500 }
    )
  }
}
