import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RemittanceStatus } from '@/types'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { status, proof_url, updated_by } = body
    const { id } = await params

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Read existing original_amounts to preserve other fields
    const { data: existing } = await supabase
      .from('tp_settlement_items')
      .select('original_amounts')
      .eq('id', id)
      .single()

    const prevAmounts = (existing?.original_amounts as Record<string, unknown>) ?? {}

    const updates: { status: RemittanceStatus; proof_url?: string | null; original_amounts: Record<string, unknown> } = {
      status: status as RemittanceStatus,
      original_amounts: {
        ...prevAmounts,
        status_updated_by: updated_by || null,
        status_updated_at: new Date().toISOString(),
      },
    }
    if (proof_url !== undefined) {
      updates.proof_url = proof_url
    }

    const { data, error } = await supabase
      .from('tp_settlement_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
