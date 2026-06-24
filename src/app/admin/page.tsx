'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Notebook {
  id: string
  title: string
  creator_email: string
  created_at: string
  last_accessed_at: string | null
  is_closed: boolean
  member_count: number
  expense_count: number
  storage_size: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null)
  const [deleting, setDeleting] = useState(false)

  const adminEmail = typeof window !== 'undefined'
    ? sessionStorage.getItem('admin_email')
    : null

  const fetchNotebooks = useCallback(async (adminEmail: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notebooks', {
        headers: { 'x-admin-email': adminEmail },
      })
      if (res.ok) {
        const data = await res.json()
        setNotebooks(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-login from sessionStorage
  useState(() => {
    if (adminEmail) {
      setEmail(adminEmail)
      setAuthed(true)
      fetchNotebooks(adminEmail)
    }
  })

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setAuthLoading(true)
    setAuthError('')

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setAuthError(data.error ?? '驗證失敗')
        return
      }

      sessionStorage.setItem('admin_email', email.trim())
      setAuthed(true)
      fetchNotebooks(email.trim())
    } catch {
      setAuthError('網路錯誤')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const storedEmail = sessionStorage.getItem('admin_email') ?? email
      const res = await fetch(`/api/admin/notebooks/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-email': storedEmail },
      })

      if (res.ok) {
        setNotebooks((prev) => prev.filter((nb) => nb.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  // State 1: Email prompt
  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">設計者管理</h1>
            <p className="text-zinc-500 text-sm">請輸入管理者 Email 以存取</p>
          </div>

          <Card>
            <CardContent className="pt-5">
              <form onSubmit={handleAuth} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="admin-email">
                    管理者 Email
                  </label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {authError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{authError}</p>
                )}

                <Button type="submit" className="w-full" disabled={authLoading || !email.trim()}>
                  {authLoading ? '驗證中…' : '進入管理'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600">
              ← 回首頁
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // State 2: Loading
  if (loading && notebooks.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">載入中…</p>
        </div>
      </div>
    )
  }

  // State 3: Notebook list
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">設計者管理</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{notebooks.length} 本記帳本</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem('admin_email')
                setAuthed(false)
                setNotebooks([])
                setEmail('')
              }}
            >
              登出
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {notebooks.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <p className="text-4xl mb-3">📓</p>
            <p>目前沒有記帳本</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">記帳本名稱</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">建立人 Email</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">建立日期</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">最後存取</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">狀態</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-500">成員</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-500">費用筆數</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-500">檔案容量</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notebooks.map((nb) => (
                      <tr key={nb.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium text-zinc-900 max-w-[200px] truncate">
                          {nb.title}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">
                          {nb.creator_email}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{formatDate(nb.created_at)}</td>
                        <td className="px-4 py-3 text-zinc-500">{formatDate(nb.last_accessed_at)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={nb.is_closed ? 'warning' : 'success'}>
                            {nb.is_closed ? '已關閉' : '使用中'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">{nb.member_count}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{nb.expense_count}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          {formatBytes(nb.storage_size)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(nb)}
                          >
                            刪除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
              {notebooks.map((nb) => (
                <Card key={nb.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate">{nb.title}</CardTitle>
                      <Badge variant={nb.is_closed ? 'warning' : 'success'} className="shrink-0">
                        {nb.is_closed ? '已關閉' : '使用中'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-zinc-500 space-y-1 mb-3">
                      <p className="truncate">{nb.creator_email}</p>
                      <p>建立：{formatDate(nb.created_at)} ・ 最後存取：{formatDate(nb.last_accessed_at)}</p>
                      <p>
                        成員 {nb.member_count} ・ 費用 {nb.expense_count} 筆 ・{' '}
                        {formatBytes(nb.storage_size)}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setDeleteTarget(nb)}
                    >
                      刪除
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              即將刪除記帳本「{deleteTarget?.title}」及其所有資料（成員、費用、上傳檔案）。此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '刪除中…' : '確認刪除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
