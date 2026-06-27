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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { action, name, password, current_password, new_password } = body
    const { id } = await params

    if (!name || !action) {
      return NextResponse.json({ error: 'name and action required' }, { status: 400 })
    }

    const supabase = createClient()

    if (action === 'verify') {
      const { data, error } = await supabase
        .from('tp_members')
        .select('password')
        .eq('notebook_id', id)
        .eq('name', name)
        .single()

      if (error || !data) return NextResponse.json({ valid: false })
      return NextResponse.json({ valid: data.password === password })
    }

    if (action === 'set_password') {
      const { data, error } = await supabase
        .from('tp_members')
        .select('password')
        .eq('notebook_id', id)
        .eq('name', name)
        .single()

      if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

      if (data.password && data.password !== current_password) {
        return NextResponse.json({ error: '原密碼錯誤' }, { status: 401 })
      }

      const { error: updateError } = await supabase
        .from('tp_members')
        .update({ password: new_password || null })
        .eq('notebook_id', id)
        .eq('name', name)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Check if member has expenses (as payer or split participant)
    const [payerCheck, splitCheck] = await Promise.all([
      supabase.from('tp_expenses').select('id', { count: 'exact', head: true }).eq('notebook_id', id).eq('payer', name),
      supabase.from('tp_expense_splits').select('id', { count: 'exact', head: true }).eq('member_name', name),
    ])

    const hasExpenses = (payerCheck.count ?? 0) > 0 || (splitCheck.count ?? 0) > 0
    if (hasExpenses) {
      return NextResponse.json({ error: '該成員已有費用分攤紀錄，不可刪除' }, { status: 409 })
    }

    const { error } = await supabase
      .from('tp_members')
      .delete()
      .eq('notebook_id', id)
      .eq('name', name)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
