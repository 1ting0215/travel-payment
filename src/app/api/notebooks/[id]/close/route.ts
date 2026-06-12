import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { creator_email, action } = body
    const { id } = await params

    if (!creator_email || !action) {
      return NextResponse.json({ error: 'creator_email and action are required' }, { status: 400 })
    }

    if (action !== 'close' && action !== 'open') {
      return NextResponse.json({ error: 'action must be "close" or "open"' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: notebook, error: fetchError } = await supabase
      .from('notebooks')
      .select('creator_email')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.creator_email !== creator_email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('notebooks')
      .update({ is_closed: action === 'close' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
