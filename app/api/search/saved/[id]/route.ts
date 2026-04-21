import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { isDiscoverSearchesMissingTableError } from '@/lib/search-cache'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const { isSaved } = await request.json() as { isSaved?: boolean }
    if (typeof isSaved !== 'boolean') {
      return NextResponse.json({ error: 'isSaved boolean required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('discover_searches')
      .update({ is_saved: isSaved })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      if (isDiscoverSearchesMissingTableError(error)) {
        return NextResponse.json({ error: 'Saved search cache is not available' }, { status: 503 })
      }

      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Saved search update error:', err)
    return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const { error } = await supabase
      .from('discover_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      if (isDiscoverSearchesMissingTableError(error)) {
        return NextResponse.json({ error: 'Saved search cache is not available' }, { status: 503 })
      }

      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Saved search delete error:', err)
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 })
  }
}
