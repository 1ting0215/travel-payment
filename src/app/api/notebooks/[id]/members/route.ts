import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { name } = body
    const { id } = await params

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('tp_members')
      .upsert({ notebook_id: id, name }, { onConflict: 'notebook_id,name' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
