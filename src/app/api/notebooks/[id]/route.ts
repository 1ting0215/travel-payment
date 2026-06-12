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

    return NextResponse.json({
      notebook: notebookRes.data,
      members: membersRes.data ?? [],
      currencies: currenciesRes.data ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
