import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient()

    const { data: expense, error } = await supabase
      .from('tp_expenses')
      .select('*, splits:tp_expense_splits(*)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, date, amount, currency, payer, split_method, splits, notes, visibility, receipt_url, category } = body

    const supabase = createClient()

    const { data: exp } = await supabase.from('tp_expenses').select('notebook_id').eq('id', id).single()
    if (exp) {
      const { data: nb } = await supabase.from('tp_notebooks').select('is_closed').eq('id', exp.notebook_id).single()
      if (nb?.is_closed) return NextResponse.json({ error: '記帳本已鎖定，無法編輯費用' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('tp_expenses')
      .update({ title, date, amount, currency, payer, split_method, notes: notes ?? null, visibility, receipt_url: receipt_url ?? null, category: category || null })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Replace splits: delete old, insert new
    await supabase.from('tp_expense_splits').delete().eq('expense_id', id)

    if (splits && splits.length > 0) {
      const splitRows = splits.map((s: { member_name: string; amount: number; ratio?: number }) => ({
        expense_id: id,
        member_name: s.member_name,
        amount: s.amount,
        ratio: s.ratio ?? null,
      }))
      const { error: splitsError } = await supabase.from('tp_expense_splits').insert(splitRows).select()
      if (splitsError) {
        return NextResponse.json({ error: splitsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient()

    const { data: exp } = await supabase.from('tp_expenses').select('notebook_id').eq('id', id).single()
    if (exp) {
      const { data: nb } = await supabase.from('tp_notebooks').select('is_closed').eq('id', exp.notebook_id).single()
      if (nb?.is_closed) return NextResponse.json({ error: '記帳本已鎖定，無法刪除費用' }, { status: 403 })
    }

    await supabase.from('tp_expense_splits').delete().eq('expense_id', id)

    const { error } = await supabase.from('tp_expenses').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
