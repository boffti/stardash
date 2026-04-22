import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/github/repo-meta?owner=&repo=
// Returns github_repo_id for a given owner/repo pair.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')

  if (!owner || !repo) {
    return NextResponse.json({ error: 'owner and repo required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error: dbError } = await adminClient
    .from('repos')
    .select('github_repo_id')
    .eq('full_name', `${owner}/${repo}`)
    .maybeSingle()

  if (dbError) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ githubRepoId: null })
  }

  return NextResponse.json({ githubRepoId: data.github_repo_id })
}
