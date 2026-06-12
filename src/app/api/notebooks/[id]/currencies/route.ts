import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('tp_currencies')
      .select('*')
      .eq('notebook_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { code, exchange_rate, base_currency } = body
    const { id } = await params

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('tp_currencies')
      .upsert(
        { notebook_id: id, code, exchange_rate: exchange_rate ?? null, base_currency: base_currency ?? null },
        { onConflict: 'notebook_id,code' }
      )
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
