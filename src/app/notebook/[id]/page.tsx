'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Notebook, Member, Currency, Expense } from '@/types'
import { formatAmount } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Tab = 'expenses' | 'settlement' | 'remittance' | 'collection'

interface NotebookData {
  notebook: Notebook
  members: Member[]
  currencies: Currency[]
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export default function NotebookPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const [data, setData] = useState<NotebookData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [identity, setIdentity] = useState<string | null>(null)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [identityLoading, setIdentityLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async (currentIdentity: string | null) => {
    try {
      const res = await fetch(`/api/notebooks/${id}`)
      if (!res.ok) {
        setError('找不到記帳本')
        return
      }
      const json: NotebookData = await res.json()
      setData(json)

      if (currentIdentity) {
        const expRes = await fetch(
          `/api/notebooks/${id}/expenses?created_by=${encodeURIComponent(currentIdentity)}`
        )
        if (expRes.ok) {
          setExpenses(await expRes.json())
        }
      }
    } catch {
      setError('載入失敗，請重新整理')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const stored = localStorage.getItem(`notebook_identity_${id}`)
    if (stored) {
      setIdentity(stored)
      fetchData(stored)
    } else {
      setIdentityOpen(true)
      fetchData(null)
    }
  }, [id, fetchData])

  async function saveIdentity(name: string) {
    if (!name.trim()) return
    setIdentityLoading(true)
    try {
      await fetch(`/api/notebooks/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      localStorage.setItem(`notebook_identity_${id}`, name.trim())
      setIdentity(name.trim())
      setIdentityOpen(false)
      const expRes = await fetch(
        `/api/notebooks/${id}/expenses?created_by=${encodeURIComponent(name.trim())}`
      )
      if (expRes.ok) setExpenses(await expRes.json())
    } finally {
      setIdentityLoading(false)
    }
  }

  function handleIdentityConfirm() {
    const name = selectedMember || newMemberName
    saveIdentity(name)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'expenses', label: '費用' },
    { key: 'settlement', label: '結算' },
    { key: 'remittance', label: '匯款' },
    { key: 'collection', label: '收款資訊' },
  ]

  if (loading) return <div className="min-h-screen bg-zinc-50"><Spinner /></div>
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <p className="text-zinc-500">{error}</p>
      </div>
    )
  }

  const { notebook, members, currencies } = data!

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Identity modal */}
      <Dialog open={identityOpen} onOpenChange={() => {}}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>你是誰？</DialogTitle>
            <DialogDescription>請選擇你的身份以開始使用記帳本</DialogDescription>
          </DialogHeader>

          {members.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-700 mb-2">現有成員</p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMember(m.name); setNewMemberName('') }}
                    className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                      selectedMember === m.name
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-indigo-400'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">新成員名稱</label>
            <Input
              placeholder="輸入你的名字"
              value={newMemberName}
              onChange={e => { setNewMemberName(e.target.value); setSelectedMember('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleIdentityConfirm() }}
            />
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleIdentityConfirm}
            disabled={identityLoading || (!selectedMember && !newMemberName.trim())}
          >
            {identityLoading ? '確認中…' : '確認'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Closed banner */}
      {notebook.is_closed && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-center">
          <span className="text-yellow-800 text-sm font-medium">⚠ 記帳本已關閉</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-zinc-900">{notebook.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-500">
            <span>{members.length} 位成員</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              {currencies.map(c => (
                <Badge key={c.id} variant="default">{c.code}</Badge>
              ))}
            </span>
            {identity && (
              <>
                <span>·</span>
                <span className="text-indigo-600 font-medium">{identity}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-zinc-200 px-4">
        <div className="max-w-2xl mx-auto flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'settlement') router.push(`/notebook/${id}/settlement`)
                else if (tab.key === 'remittance') router.push(`/notebook/${id}/remittance`)
                else setActiveTab(tab.key)
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {activeTab === 'expenses' && (
          <ExpenseList expenses={expenses} identity={identity} />
        )}
        {activeTab === 'collection' && (
          <CollectionTab notebookId={id} members={members} identity={identity} />
        )}
      </div>

      {/* FAB */}
      {!notebook.is_closed && (
        <Link
          href={`/notebook/${id}/expenses/new`}
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-white text-sm font-semibold shadow-lg hover:bg-indigo-700 transition-colors"
        >
          + 新增費用
        </Link>
      )}
    </div>
  )
}

function ExpenseList({ expenses, identity }: { expenses: Expense[]; identity: string | null }) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">🧾</div>
        <p className="text-zinc-500 text-sm">還沒有費用，點擊右下角按鈕新增</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {expenses.map(expense => (
        <ExpenseCard key={expense.id} expense={expense} identity={identity} />
      ))}
    </div>
  )
}

function ExpenseCard({ expense, identity }: { expense: Expense; identity: string | null }) {
  const isOwn = expense.created_by === identity
  const isPrivate = expense.visibility === 'private'

  const dateStr = new Date(expense.date).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card className={isOwn && isPrivate ? 'border-indigo-100 bg-indigo-50/30' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-zinc-900 truncate">{expense.title}</span>
              <Badge variant={isPrivate ? 'warning' : 'default'}>
                {isPrivate ? '個人' : '共同'}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">
              {expense.payer} 付款 · {dateStr}
            </p>
            {expense.notes && (
              <p className="text-xs text-zinc-400 mt-1 truncate">{expense.notes}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-zinc-900">
              {formatAmount(expense.amount, expense.currency)}
            </p>
            {expense.splits && expense.splits.length > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {expense.splits.length} 人均攤
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CollectionTab({
  notebookId,
  members,
  identity,
}: {
  notebookId: string
  members: Member[]
  identity: string | null
}) {
  const [collections, setCollections] = useState<
    { id: string; member_name: string; account_info: string | null; qr_code_url: string | null; notes: string | null }[]
  >([])
  const [editing, setEditing] = useState(false)
  const [accountInfo, setAccountInfo] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/notebooks/${notebookId}/collection`)
      .then(r => r.json())
      .then(setCollections)
      .catch(() => {})
  }, [notebookId])

  const myCollection = collections.find(c => c.member_name === identity)

  useEffect(() => {
    if (myCollection) {
      setAccountInfo(myCollection.account_info ?? '')
      setNotes(myCollection.notes ?? '')
    }
  }, [myCollection])

  async function handleSave() {
    if (!identity) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name: identity, account_info: accountInfo, notes }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCollections(prev => {
          const idx = prev.findIndex(c => c.member_name === identity)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = updated
            return copy
          }
          return [...prev, updated]
        })
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* My collection info */}
      {identity && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-zinc-900">我的收款資訊</p>
              <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? '取消' : '編輯'}
              </Button>
            </div>
            {editing ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">帳戶資訊（銀行帳號、LINE Pay 等）</label>
                  <textarea
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="例：玉山銀行 808-123456789 王小明"
                    value={accountInfo}
                    onChange={e => setAccountInfo(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">備注</label>
                  <Input
                    placeholder="其他說明"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? '儲存中…' : '儲存'}
                </Button>
              </div>
            ) : myCollection ? (
              <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                {myCollection.account_info || <span className="text-zinc-400">尚未填寫</span>}
                {myCollection.notes && (
                  <p className="text-zinc-500 mt-1 text-xs">{myCollection.notes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">尚未填寫收款資訊</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Other members */}
      {collections.filter(c => c.member_name !== identity).map(c => (
        <Card key={c.member_name}>
          <CardContent className="pt-4">
            <p className="font-medium text-zinc-900 mb-1">{c.member_name}</p>
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">
              {c.account_info || <span className="text-zinc-400">未填寫</span>}
            </p>
            {c.notes && <p className="text-xs text-zinc-400 mt-1">{c.notes}</p>}
            {c.qr_code_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.qr_code_url} alt="QR Code" className="mt-2 w-28 h-28 object-contain rounded" />
            )}
          </CardContent>
        </Card>
      ))}

      {collections.length === 0 && !identity && (
        <p className="text-center text-zinc-400 text-sm py-12">尚無收款資訊</p>
      )}
    </div>
  )
}
