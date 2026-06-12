import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const notebookId = formData.get('notebook_id') as string | null

    if (!file || !notebookId) {
      return NextResponse.json({ error: 'file and notebook_id required' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '僅支援圖片格式' }, { status: 400 })
    }
    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: '檔案超過 1 MB 上限' }, { status: 400 })
    }

    const path = `${notebookId}/${Date.now()}_${file.name}`

    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('tp-receipts')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: urlData } = supabase.storage.from('tp-receipts').getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
