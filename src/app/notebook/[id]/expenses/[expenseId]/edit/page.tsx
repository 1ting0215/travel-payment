'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Member, Currency, Expense } from '@/types'
import { formatNum } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SplitMethod = 'equal' | 'custom' | 'ratio'
type Visibility = 'shared' | 'private'

interface SplitEntry {
  member_name: string
  amount: number
  ratio: number
  checked: boolean
}

export default function EditExpensePage() {
  const params = useParams<{ id: string; expenseId: string }>()
  const id = params.id
  const expenseId = params.expenseId
  const router = useRouter()

  const [members, setMembers] = useState<Member[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [identity, setIdentity] = useState<string>('')
  const [isLocked, setIsLocked] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [payer, setPayer] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('shared')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)
  const [addMemberInline, setAddMemberInline] = useState(false)
  const [inlineMemberName, setInlineMemberName] = useState('')
  const [showNewPayer, setShowNewPayer] = useState(false)
  const [newPayerName, setNewPayerName] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const currDecimals = currencies.find(c => c.code === currency)?.decimal_places ?? 2

  useEffect(() => {
    const stored = sessionStorage.getItem(`notebook_identity_${id}`)
    if (stored) setIdentity(stored)

    Promise.all([
      fetch(`/api/notebooks/${id}`).then(r => r.json()),
      fetch(`/api/expenses/${expenseId}`).then(r => r.json()),
    ]).then(([notebookData, expense]: [{ notebook: { is_closed: boolean }; members: Member[]; currencies: Currency[] }, Expense]) => {
      setIsLocked(notebookData.notebook?.is_closed ?? false)
      const memberList = notebookData.members ?? []
      const currList = notebookData.currencies ?? []
      setMembers(memberList)
      setCurrencies(currList)

      // Fill form with expense data
      setTitle(expense.title)
      setDate(expense.date)
      setAmount(String(expense.amount))
      setCurrency(expense.currency)
      setPayer(expense.payer)
      setVisibility(expense.visibility)
      setSplitMethod(expense.split_method)
      setCategory(expense.category ?? '')
      setNotes(expense.notes ?? '')
      setExistingReceiptUrl(expense.receipt_url)

      // Build splits from expense data
      const expenseSplits = expense.splits ?? []
      const splitEntries: SplitEntry[] = memberList.map(m => {
        const existing = expenseSplits.find(s => s.member_name === m.name)
        return {
          member_name: m.name,
          amount: existing?.amount ?? 0,
          ratio: existing?.ratio ?? 1,
          checked: !!existing,
        }
      })
      // Add splits for members not in the member list
      for (const s of expenseSplits) {
        if (!splitEntries.find(e => e.member_name === s.member_name)) {
          splitEntries.push({ member_name: s.member_name, amount: s.amount, ratio: s.ratio ?? 1, checked: true })
        }
      }
      setSplits(splitEntries)
    }).finally(() => setLoading(false))
  }, [id, expenseId])

  // Recalculate equal split
  useEffect(() => {
    if (splitMethod !== 'equal') return
    const checked = splits.filter(s => s.checked)
    if (checked.length === 0) return
    const numericAmount = parseFloat(amount) || 0
    const factor = Math.pow(10, currDecimals)
    const each = Math.floor((numericAmount / checked.length) * factor) / factor
    const totalAssigned = Math.round(each * checked.length * factor) / factor
    const remainder = Math.round((numericAmount - totalAssigned) * factor) / factor
    const remainderTarget = checked.find(s => s.member_name === payer)?.member_name ?? checked[0].member_name
    setSplits(prev =>
      prev.map(s => ({
        ...s,
        amount: s.checked
          ? (s.member_name === remainderTarget ? each + remainder : each)
          : 0,
      }))
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, splitMethod, payer, currDecimals, splits.map(s => s.checked).join(',')])

  // Recalculate ratio split
  useEffect(() => {
    if (splitMethod !== 'ratio') return
    const numericAmount = parseFloat(amount) || 0
    const checked = splits.filter(s => s.checked)
    const totalRatio = checked.reduce((sum, s) => sum + s.ratio, 0)
    if (totalRatio === 0) return
    const factor = Math.pow(10, currDecimals)
    const amounts = checked.map(s => Math.floor((numericAmount * s.ratio / totalRatio) * factor) / factor)
    const totalAssigned = Math.round(amounts.reduce((a, b) => a + b, 0) * factor) / factor
    const remainder = Math.round((numericAmount - totalAssigned) * factor) / factor
    const remainderTarget = checked.find(s => s.member_name === payer)?.member_name ?? checked[0].member_name
    let checkedIdx = 0
    setSplits(prev =>
      prev.map(s => {
        if (!s.checked) return { ...s, amount: 0 }
        const base = amounts[checkedIdx++]
        return { ...s, amount: s.member_name === remainderTarget ? base + remainder : base }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, splitMethod, payer, currDecimals, splits.map(s => `${s.ratio}:${s.checked}`).join(',')])

  async function handleAddMemberInline() {
    if (!inlineMemberName.trim()) return
    const name = inlineMemberName.trim()
    await fetch(`/api/notebooks/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const newMember: Member = { id: crypto.randomUUID(), notebook_id: id, name, created_at: new Date().toISOString() }
    setMembers(prev => [...prev, newMember])
    setSplits(prev => [...prev, { member_name: name, amount: 0, ratio: 1, checked: true }])
    setInlineMemberName('')
    setAddMemberInline(false)
  }

  async function handleAddPayer() {
    if (!newPayerName.trim()) return
    const name = newPayerName.trim()
    if (members.some(m => m.name === name)) {
      setPayer(name)
      setNewPayerName('')
      setShowNewPayer(false)
      return
    }
    await fetch(`/api/notebooks/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const newMember: Member = { id: crypto.randomUUID(), notebook_id: id, name, created_at: new Date().toISOString() }
    setMembers(prev => [...prev, newMember])
    setSplits(prev => [...prev, { member_name: name, amount: 0, ratio: 1, checked: true }])
    setPayer(name)
    setNewPayerName('')
    setShowNewPayer(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const numericAmount = parseFloat(amount)
    if (!title.trim() || !date || isNaN(numericAmount) || numericAmount <= 0 || !currency || !payer) {
      setError('請填寫所有必填欄位')
      return
    }

    const activeSplits = visibility === 'shared'
      ? splits.filter(s => s.checked).map(s => ({
          member_name: s.member_name,
          amount: s.amount,
          ratio: splitMethod === 'ratio' ? s.ratio : null,
        }))
      : [{ member_name: payer, amount: numericAmount, ratio: null }]

    if (visibility === 'shared' && activeSplits.length === 0) {
      setError('請選擇至少一位分攤成員')
      return
    }

    if (visibility === 'shared' && splitMethod !== 'equal') {
      const splitTotal = activeSplits.reduce((sum, s) => sum + s.amount, 0)
      if (Math.abs(splitTotal - numericAmount) > 0.01) {
        setError(`分攤金額合計 ${splitTotal.toFixed(currDecimals)} 與總金額 ${numericAmount.toFixed(currDecimals)} 不符`)
        return
      }
    }

    setSubmitting(true)
    try {
      let receiptUrl: string | null = existingReceiptUrl
      if (receipt) {
        const form = new FormData()
        form.append('file', receipt)
        form.append('notebook_id', id)
        form.append('expense_title', title.trim())
        const upRes = await fetch('/api/upload/receipt', { method: 'POST', body: form })
        if (!upRes.ok) {
          const upJson = await upRes.json()
          setError(upJson.error ?? '收據上傳失敗')
          setSubmitting(false)
          return
        }
        const { url } = await upRes.json()
        receiptUrl = url
      }

      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          date,
          amount: numericAmount,
          currency,
          payer,
          split_method: visibility === 'private' ? 'equal' : splitMethod,
          splits: activeSplits,
          notes: notes.trim() || null,
          visibility,
          category: category || null,
          receipt_url: receiptUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '更新失敗')
        return
      }

      router.push(`/notebook/${id}`)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="font-semibold text-zinc-900">編輯費用</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5 pb-24">
        {isLocked && (
          <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center">
            🔒 記帳本已鎖定，僅供檢視
          </p>
        )}
        <fieldset disabled={isLocked} className={`contents${isLocked ? ' [&_input]:opacity-60 [&_textarea]:opacity-60 [&_button]:opacity-60 [&_select]:opacity-60' : ''}`}>
        {/* Basic info */}
        <Card>
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                費用名稱 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="例：晚餐"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">日期 <span className="text-red-500">*</span></label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            {/* Amount + Currency */}
            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="text-sm font-medium text-zinc-700">金額 <span className="text-red-500">*</span></label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5 w-24 shrink-0">
                <label className="text-sm font-medium text-zinc-700">幣別 <span className="text-red-500">*</span></label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-10 overflow-hidden">
                    <span className="truncate">{currency || '幣別'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => (
                      <SelectItem key={c.id} value={c.code}>
                        <span>{c.code}{c.code === 'TWD' ? ' ★' : ''}{c.exchange_rate ? ` (1${c.code}=${c.exchange_rate}TWD)` : ''}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payer */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">付款人 <span className="text-red-500">*</span></label>
              <Select value={payer} onValueChange={val => {
                if (val === '__new_payer__') setShowNewPayer(true)
                else { setPayer(val); setShowNewPayer(false) }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇付款人" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                  <SelectItem value="__new_payer__">＋ 新增付款人</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showNewPayer && (
              <div className="flex gap-2 items-end p-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
                <Input
                  placeholder="輸入新付款人名稱"
                  value={newPayerName}
                  onChange={e => setNewPayerName(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleAddPayer} disabled={!newPayerName.trim()} className="h-10 shrink-0 whitespace-nowrap">新增</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewPayer(false); setNewPayerName('') }} className="h-10 shrink-0 whitespace-nowrap">取消</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visibility */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-zinc-700 mb-3">費用類型</p>
            <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setVisibility('shared')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  visibility === 'shared'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                共同分攤
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 py-2.5 text-sm font-medium border-l border-zinc-200 transition-colors ${
                  visibility === 'private'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                個人費用（開發中）
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Split section — only for shared */}
        {visibility === 'shared' && (
          <Card>
            <CardContent className="pt-4 flex flex-col gap-4">
              {/* Split method */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-zinc-700">分攤方式</p>
                <div className="flex gap-2">
                  {(['equal', 'custom', 'ratio'] as SplitMethod[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSplitMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        splitMethod === m
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                      }`}
                    >
                      {m === 'equal' ? '均分' : m === 'custom' ? '自訂金額' : '按比例（開發中）'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split participants */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700">分攤成員</p>
                  <button
                    type="button"
                    onClick={() => setAddMemberInline(v => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    ＋ 新增成員
                  </button>
                </div>
                {addMemberInline && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="成員名稱"
                      value={inlineMemberName}
                      onChange={e => setInlineMemberName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button type="button" size="sm" onClick={handleAddMemberInline} disabled={!inlineMemberName.trim()} className="h-8 shrink-0 whitespace-nowrap">新增</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setAddMemberInline(false); setInlineMemberName('') }} className="h-8 shrink-0 whitespace-nowrap">取消</Button>
                  </div>
                )}
                {splits.map((split, idx) => (
                  <div key={split.member_name} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`split-${idx}`}
                      checked={split.checked}
                      onChange={e => setSplits(prev => prev.map((s, i) =>
                        i === idx ? { ...s, checked: e.target.checked } : s
                      ))}
                      className="w-4 h-4 rounded border-zinc-300 text-indigo-600"
                    />
                    <label htmlFor={`split-${idx}`} className="flex-1 text-sm text-zinc-800">
                      {split.member_name}
                    </label>

                    {splitMethod === 'equal' && split.checked && (
                      <span className="text-sm text-zinc-500 min-w-[5rem] text-right">
                        {currency} {formatNum(split.amount, currDecimals)}
                      </span>
                    )}

                    {splitMethod === 'custom' && split.checked && (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={split.amount || ''}
                        onChange={e => setSplits(prev => prev.map((s, i) =>
                          i === idx ? { ...s, amount: parseFloat(e.target.value) || 0 } : s
                        ))}
                        className="w-28 text-right"
                      />
                    )}

                    {splitMethod === 'ratio' && split.checked && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="1"
                          value={split.ratio || ''}
                          onChange={e => setSplits(prev => prev.map((s, i) =>
                            i === idx ? { ...s, ratio: parseFloat(e.target.value) || 0 } : s
                          ))}
                          className="w-16 text-right"
                        />
                        <span className="text-xs text-zinc-400 min-w-[5rem]">
                          ≈ {currency} {formatNum(split.amount, currDecimals)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Receipt */}
        <Card>
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">費用分類（選填）</label>
              <div className="flex gap-2 flex-wrap">
                {['', '食', '住', '行', '其他'].map(opt => (
                  <button
                    key={opt || '無'}
                    type="button"
                    onClick={() => setCategory(opt)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      category === opt
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                    }`}
                  >
                    {opt || '無'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">備註（選填）</label>
              <textarea
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                placeholder="附加說明"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">收據照片（選填）</label>
              {existingReceiptUrl && !receipt && (
                <p className="text-xs text-indigo-600">已有收據，重新上傳將取代</p>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => setReceipt(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
              />
              <p className="text-xs text-zinc-400">限圖片格式，1 MB 以內</p>
            </div>
          </CardContent>
        </Card>

        </fieldset>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {!isLocked && (
          <>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? '更新中…' : '更新費用'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              刪除此筆費用
            </Button>
          </>
        )}
      </form>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>確認要刪除此筆資料？此操作無法復原。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true)
                try {
                  const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
                  if (res.ok) {
                    router.push(`/notebook/${id}`)
                  }
                } finally {
                  setDeleteLoading(false)
                }
              }}
            >
              {deleteLoading ? '刪除中…' : '確認刪除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
