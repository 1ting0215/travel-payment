import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const { id } = await params

    const [notebookRes, membersRes, currenciesRes] = await Promise.all([
      supabase.from('tp_notebooks').select('*').eq('id', id).single(),
      supabase.from('tp_members').select('*').eq('notebook_id', id),
      supabase.from('tp_currencies').select('*').eq('notebook_id', id),
    ])

    if (notebookRes.error) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    // Update last_accessed_at (fire-and-forget, don't block response)
    supabase.from('tp_notebooks').update({ last_accessed_at: new Date().toISOString() }).eq('id', id).then(() => {})

    const members = (membersRes.data ?? []).map((m: Record<string, unknown>) => {
      const { password, ...rest } = m
      return { ...rest, has_password: !!password }
    })

    return NextResponse.json({
      notebook: notebookRes.data,
      members,
      currencies: currenciesRes.data ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
