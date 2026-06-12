'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function LandingPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !email.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          creator_email: email.trim(),
          password: password.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '建立失敗，請稍後再試')
        return
      }

      const data = await res.json()
      setNotebookId(data.id)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white text-2xl mb-5">
            ✈
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-3">旅行分帳</h1>
          <p className="text-zinc-500 text-base leading-relaxed">
            無需註冊，建立記帳本即可開始
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>建立記帳本</CardTitle>
          </CardHeader>
          <CardContent>
            {notebookId ? (
              <div className="py-6 flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-zinc-900 font-semibold text-lg mb-1">記帳本已建立</p>
                  <p className="text-zinc-500 text-sm">
                    連結已寄至 <span className="font-medium text-zinc-700">{email}</span>
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => router.push(`/notebook/${notebookId}`)}
                >
                  立即進入記帳本
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setNotebookId(null)
                    setTitle('')
                    setEmail('')
                    setPassword('')
                  }}
                >
                  建立另一個記帳本
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="title">
                    記帳本名稱 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="title"
                    placeholder="例：東京五日遊"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="email">
                    您的 Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-zinc-400">記帳本連結將寄至此信箱</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="password">
                    密碼保護 <span className="text-zinc-400 font-normal">（選填）</span>
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="設定密碼以保護記帳本"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-1"
                  disabled={loading || !title.trim() || !email.trim()}
                >
                  {loading ? '建立中…' : '建立記帳本'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-zinc-400 mt-6">
          記帳本將於建立後 3 個月自動到期
        </p>
      </div>
    </div>
  )
}
