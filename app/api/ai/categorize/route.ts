import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { categorizeRepos } from '@/lib/ai-categorize'

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { repos } = await request.json()

    if (!repos?.length) {
      return NextResponse.json({ error: 'No repos provided' }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured on server' }, { status: 500 })
    }

    const result = await categorizeRepos(repos, apiKey)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Categorization error:', err)
    return NextResponse.json({ error: 'Failed to categorize repositories' }, { status: 500 })
  }
}
