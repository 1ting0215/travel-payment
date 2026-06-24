import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function checkAdmin(request: NextRequest): boolean {
  const email = request.headers.get('x-admin-email')
  const adminEmail = process.env.ADMIN_EMAIL
  if (!email || !adminEmail) return false
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: '無權限存取' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supabase = createClient()

    // Delete storage files from all 3 buckets
    const buckets = ['tp-receipts', 'tp-proofs', 'tp-qrcodes']
    for (const bucket of buckets) {
      const { data: files } = await supabase.storage.from(bucket).list(id)
      if (files && files.length > 0) {
        const paths = files.map((f) => `${id}/${f.name}`)
        await supabase.storage.from(bucket).remove(paths)
      }
    }

    // Delete notebook row (CASCADE handles child tables)
    const { error } = await supabase.from('tp_notebooks').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
