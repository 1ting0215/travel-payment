import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('collection_info')
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
  const { id } = await params
  return upsertCollection(request, id)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return upsertCollection(request, id)
}

async function upsertCollection(request: NextRequest, notebookId: string) {
  try {
    const body = await request.json()
    const { member_name, account_info, qr_code_url, notes } = body

    if (!member_name) {
      return NextResponse.json({ error: 'member_name is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('collection_info')
      .upsert(
        {
          notebook_id: notebookId,
          member_name,
          account_info: account_info ?? null,
          qr_code_url: qr_code_url ?? null,
          notes: notes ?? null,
        },
        { onConflict: 'notebook_id,member_name' }
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
