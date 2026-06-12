import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBalances, generateTransferList } from '@/lib/settlement'
import type { Expense, ExpenseSplit } from '@/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('expenses')
      .select('*, splits:expense_splits(*)')
      .eq('notebook_id', id)
      .eq('visibility', 'shared')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const expenses = (data ?? []) as (Expense & { splits: ExpenseSplit[] })[]
    const balances = calculateBalances(expenses)
    const transfers = generateTransferList(balances)

    return NextResponse.json({ balances, transfers })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { transfers } = body
    const { id } = await params

    if (!transfers || !Array.isArray(transfers)) {
      return NextResponse.json({ error: 'transfers array is required' }, { status: 400 })
    }

    const supabase = createClient()

    const rows = transfers.map((t: { from_member: string; to_member: string; amount: number; currency: string }) => ({
      notebook_id: id,
      from_member: t.from_member,
      to_member: t.to_member,
      amount: t.amount,
      currency: t.currency,
      status: 'unpaid',
      proof_url: null,
    }))

    const { data, error } = await supabase.from('settlement_items').insert(rows).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
