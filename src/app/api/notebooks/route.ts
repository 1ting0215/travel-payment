import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, creator_email, password } = body

    if (!title || !creator_email) {
      return NextResponse.json({ error: 'title and creator_email are required' }, { status: 400 })
    }

    const supabase = createClient()

    let passwordHash: string | null = null
    if (password) {
      passwordHash = await bcrypt.hash(password, 10)
    }

    const { data, error } = await supabase
      .from('tp_notebooks')
      .insert({
        title,
        creator_email,
        password_hash: passwordHash,
        is_closed: false,
      })
      .select('id, title')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const notebookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/notebook/${data.id}`

    await resend.emails.send({
      from: 'Travel Payment <onboarding@resend.dev>',
      to: creator_email,
      subject: `Your travel notebook: ${title}`,
      html: `<p>Your notebook <strong>${title}</strong> has been created.</p><p><a href="${notebookUrl}">Open notebook</a></p><p>Link: ${notebookUrl}</p>`,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
