import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const createdBy = searchParams.get('created_by')

    let query = supabase
      .from('expenses')
      .select('*, splits:expense_splits(*)')
      .eq('notebook_id', id)
      .order('date', { ascending: false })

    if (createdBy) {
      query = query.or(`visibility.eq.shared,and(visibility.eq.private,created_by.eq.${createdBy})`)
    } else {
      query = query.eq('visibility', 'shared')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
