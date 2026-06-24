import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function checkAdmin(request: NextRequest): boolean {
  const email = request.headers.get('x-admin-email')
  const adminEmail = process.env.ADMIN_EMAIL
  if (!email || !adminEmail) return false
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: '無權限存取' }, { status: 401 })
  }

  try {
    const supabase = createClient()

    const { data: notebooks, error } = await supabase
      .from('tp_notebooks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = await Promise.all(
      (notebooks ?? []).map(async (nb) => {
        const [membersRes, expensesRes] = await Promise.all([
          supabase.from('tp_members').select('id', { count: 'exact', head: true }).eq('notebook_id', nb.id),
          supabase.from('tp_expenses').select('id', { count: 'exact', head: true }).eq('notebook_id', nb.id),
        ])

        let storageSize = 0
        const buckets = ['tp-receipts', 'tp-proofs', 'tp-qrcodes']
        for (const bucket of buckets) {
          const { data: files } = await supabase.storage.from(bucket).list(nb.id)
          if (files) {
            storageSize += files.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
          }
        }

        return {
          ...nb,
          member_count: membersRes.count ?? 0,
          expense_count: expensesRes.count ?? 0,
          storage_size: storageSize,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
