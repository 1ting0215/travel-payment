import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SplitMethod, Visibility } from '@/types'

interface SplitInput {
  member_name: string
  amount: number
  ratio?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      notebook_id,
      title,
      date,
      amount,
      currency,
      payer,
      split_method,
      splits,
      notes,
      visibility,
      created_by,
      category,
    } = body

    if (!notebook_id || !title || !date || amount == null || !currency || !payer || !split_method || !splits || !visibility || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: expense, error: expenseError } = await supabase
      .from('tp_expenses')
      .insert({
        notebook_id,
        title,
        date,
        amount,
        currency,
        payer,
        split_method: split_method as SplitMethod,
        notes: notes ?? null,
        visibility: visibility as Visibility,
        category: category || null,
        created_by,
      })
      .select()
      .single()

    if (expenseError) {
      return NextResponse.json({ error: expenseError.message }, { status: 500 })
    }

    const splitRows = (splits as SplitInput[]).map((s) => ({
      expense_id: expense.id,
      member_name: s.member_name,
      amount: s.amount,
      ratio: s.ratio ?? null,
    }))

    const { data: savedSplits, error: splitsError } = await supabase
      .from('tp_expense_splits')
      .insert(splitRows)
      .select()

    if (splitsError) {
      return NextResponse.json({ error: splitsError.message }, { status: 500 })
    }

    return NextResponse.json({ ...expense, splits: savedSplits }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
