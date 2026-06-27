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
  const [identityStep, setIdentityStep] = useState<'choose' | 'password' | 'set_password'>('choose')
  const [identityPending, setIdentityPending] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [passwordVerified, setPasswordVerified] = useState(false)
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [membersOpen, setMembersOpen] = useState(false)
  const [addMemberName, setAddMemberName] = useState('')
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  // Share link copy
  const [copied, setCopied] = useState(false)

  // Close/reopen dialog
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeEmail, setCloseEmail] = useState('')
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError] = useState('')

  // Currencies dialog
  const [currenciesOpen, setCurrenciesOpen] = useState(false)
  const [editingCurrencyCode, setEditingCurrencyCode] = useState<string | null>(null)
  const [editingRate, setEditingRate] = useState('')
  const [editingDecimals, setEditingDecimals] = useState('2')
  const [savingRate, setSavingRate] = useState(false)
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencyRate, setNewCurrencyRate] = useState('')
  const [newCurrencyDecimals, setNewCurrencyDecimals] = useState('2')
  const [addCurrencyLoading, setAddCurrencyLoading] = useState(false)

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
    const stored = sessionStorage.getItem(`notebook_identity_${id}`)
    const pwVerified = sessionStorage.getItem(`notebook_pw_verified_${id}`)
    if (stored) {
      setIdentity(stored)
      if (pwVerified === stored) setPasswordVerified(true)
      fetchData(stored)
    } else {
      setIdentityOpen(true)
      fetchData(null)
    }
  }, [id, fetchData])

  function resetIdentityDialog() {
    setIdentityStep('choose')
    setIdentityPending('')
    setPasswordInput('')
    setPasswordError('')
    setSetupPassword('')
    setSelectedMember('')
    setNewMemberName('')
  }

  async function completeLogin(name: string, verified: boolean) {
    sessionStorage.setItem(`notebook_identity_${id}`, name)
    if (verified) {
      sessionStorage.setItem(`notebook_pw_verified_${id}`, name)
    } else {
      sessionStorage.removeItem(`notebook_pw_verified_${id}`)
    }
    setIdentity(name)
    setPasswordVerified(verified)
    setIdentityOpen(false)
    resetIdentityDialog()
    const expRes = await fetch(`/api/notebooks/${id}/expenses?created_by=${encodeURIComponent(name)}`)
    if (expRes.ok) setExpenses(await expRes.json())
  }

  function handleIdentityConfirm() {
    const name = (selectedMember || newMemberName).trim()
    if (!name) return
    const existing = members.find(m => m.name === name)
    if (!existing) {
      handleNewMemberLogin(name)
      return
    }
    setIdentityPending(name)
    if (existing.has_password) {
      setIdentityStep('password')
      setPasswordInput('')
      setPasswordError('')
    } else {
      setIdentityStep('set_password')
      setSetupPassword('')
    }
  }

  async function serverCheck(name: string): Promise<{ exists: boolean; has_password: boolean }> {
    const res = await fetch(`/api/notebooks/${id}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', name }),
    })
    return res.json()
  }

  async function handleNewMemberLogin(name: string) {
    setIdentityLoading(true)
    try {
      // Always verify server state — client list may be stale
      const check = await serverCheck(name)
      if (check.exists) {
        setIdentityPending(name)
        if (check.has_password) {
          setIdentityStep('password')
          setPasswordInput('')
          setPasswordError('')
        } else {
          setIdentityStep('set_password')
          setSetupPassword('')
        }
        return
      }
      // Truly new member
      await fetch(`/api/notebooks/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      await completeLogin(name, false)
    } finally {
      setIdentityLoading(false)
    }
  }

  async function handlePasswordConfirm() {
    if (!passwordInput.trim()) { setPasswordError('請輸入密碼'); return }
    setIdentityLoading(true)
    try {
      const res = await fetch(`/api/notebooks/${id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', name: identityPending, password: passwordInput }),
      })
      const json = await res.json()
      if (!json.valid) {
        setPasswordError('密碼錯囉！請確認是否選對角色')
        return
      }
      await completeLogin(identityPending, true)
    } finally {
      setIdentityLoading(false)
    }
  }

  async function handleSetupPasswordConfirm(skip: boolean) {
    setIdentityLoading(true)
    try {
      // Re-verify server state before completing login
      const check = await serverCheck(identityPending)
      if (check.has_password) {
        // Password was set between page load and now — must verify
        setIdentityStep('password')
        setPasswordInput('')
        setPasswordError('')
        return
      }
      if (!skip && setupPassword.trim()) {
        await fetch(`/api/notebooks/${id}/members`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_password', name: identityPending, new_password: setupPassword.trim() }),
        })
        // Update local members state so has_password reflects reality
        setData(prev => prev ? {
          ...prev,
          members: prev.members.map(m => m.name === identityPending ? { ...m, has_password: true } : m),
        } : prev)
        await completeLogin(identityPending, true)
      } else {
        await completeLogin(identityPending, false)
      }
    } finally {
      setIdentityLoading(false)
    }
  }

  async function handlePasswordChange() {
    if (!pwNew.trim()) { setPwError('請輸入新密碼'); return }
    const myMember = members.find(m => m.name === identity)
    if (myMember?.has_password && !pwOld.trim()) { setPwError('請輸入原密碼'); return }
    setPwSaving(true)
    setPwError('')
    try {
      const res = await fetch(`/api/notebooks/${id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_password',
          name: identity,
          current_password: myMember?.has_password ? pwOld : undefined,
          new_password: pwNew.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setPwError(json.error ?? '變更失敗'); return }
      window.location.reload()
    } finally {
      setPwSaving(false)
    }
  }

  async function handleAddMember() {
    if (!addMemberName.trim()) return
    setAddMemberLoading(true)
    try {
      const res = await fetch(`/api/notebooks/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addMemberName.trim() }),
      })
      if (res.ok) {
        setAddMemberName('')
        await fetchData(identity)
      }
    } finally {
      setAddMemberLoading(false)
    }
  }

  async function handleDeleteMember(name: string) {
    if (!confirm(`確定要刪除成員「${name}」嗎？`)) return
    const res = await fetch(`/api/notebooks/${id}/members?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || '刪除失敗')
      return
    }
    await fetchData(identity)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleCloseNotebook() {
    if (!data) return
    setCloseLoading(true)
    setCloseError('')
    try {
      const action = data.notebook.is_closed ? 'open' : 'close'
      const res = await fetch(`/api/notebooks/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_email: closeEmail, action }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCloseError(json.error ?? '操作失敗')
        return
      }
      setData(prev => prev ? { ...prev, notebook: { ...prev.notebook, is_closed: action === 'close' } } : prev)
      setCloseOpen(false)
      setCloseEmail('')
    } finally {
      setCloseLoading(false)
    }
  }

  async function handleSaveRate(code: string) {
    const rate = parseFloat(editingRate)
    if (isNaN(rate) || rate <= 0) return
    const dp = parseInt(editingDecimals) || 0
    setSavingRate(true)
    try {
      const res = await fetch(`/api/notebooks/${id}/currencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, exchange_rate: rate, base_currency: 'TWD', decimal_places: dp }),
      })
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            currencies: prev.currencies.map(c =>
              c.code === code ? { ...c, exchange_rate: rate, base_currency: 'TWD', decimal_places: dp } : c
            ),
          }
        })
        setEditingCurrencyCode(null)
        setEditingRate('')
        setEditingDecimals('2')
      }
    } finally {
      setSavingRate(false)
    }
  }

  async function handleAddCurrency() {
    if (!newCurrencyCode.trim()) return
    const code = newCurrencyCode.trim().toUpperCase()
    const rate = parseFloat(newCurrencyRate) || null
    setAddCurrencyLoading(true)
    try {
      const res = await fetch(`/api/notebooks/${id}/currencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, exchange_rate: rate, base_currency: rate ? 'TWD' : null, decimal_places: parseInt(newCurrencyDecimals) || 2 }),
      })
      if (res.ok) {
        const newCurr = await res.json()
        setData(prev => prev ? { ...prev, currencies: [...prev.currencies, newCurr] } : prev)
        setNewCurrencyCode('')
        setNewCurrencyRate('')
        setNewCurrencyDecimals('2')
      }
    } finally {
      setAddCurrencyLoading(false)
    }
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
    <div className="min-h-screen bg-zinc-50 overflow-x-hidden">
      {/* Identity modal */}
      <Dialog open={identityOpen} onOpenChange={() => {}}>
        <DialogContent className="mx-4">
          {identityStep === 'choose' && (
            <>
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
                        {m.name}{m.has_password ? ' 🔒' : ''}
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
                />
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleIdentityConfirm}
                disabled={identityLoading || (!selectedMember && !newMemberName.trim())}
              >
                {identityLoading ? '確認中…' : '確認'}
              </Button>
            </>
          )}

          {identityStep === 'password' && (
            <>
              <DialogHeader>
                <DialogTitle>輸入密碼</DialogTitle>
                <DialogDescription>角色「{identityPending}」已設定密碼，請輸入才能登入</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                <Input
                  type="password"
                  placeholder="請輸入密碼"
                  value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handlePasswordConfirm() }}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</p>
                )}
                <Button className="w-full" onClick={handlePasswordConfirm} disabled={identityLoading}>
                  {identityLoading ? '驗證中…' : '登入'}
                </Button>
                <button
                  type="button"
                  onClick={() => { resetIdentityDialog() }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 text-center"
                >
                  ← 返回選擇角色
                </button>
              </div>
            </>
          )}

          {identityStep === 'set_password' && (
            <>
              <DialogHeader>
                <DialogTitle>設定密碼（選填）</DialogTitle>
                <DialogDescription>角色「{identityPending}」尚未設定密碼，可選擇設定以保護此角色</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                <Input
                  type="password"
                  placeholder="輸入密碼（留空跳過）"
                  value={setupPassword}
                  onChange={e => setSetupPassword(e.target.value)}
                />
                <Button className="w-full" onClick={() => handleSetupPasswordConfirm(false)} disabled={identityLoading}>
                  {identityLoading ? '處理中…' : setupPassword.trim() ? '設定並登入' : '跳過並登入'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Members management dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>成員管理</DialogTitle>
            <DialogDescription>新增或查看記帳本成員</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 mb-4">
            {members.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-zinc-100 text-zinc-700 border border-zinc-200">
                {m.name}
                <button
                  type="button"
                  onClick={() => handleDeleteMember(m.name)}
                  className="ml-1 text-zinc-400 hover:text-red-500 transition-colors"
                  title={`刪除 ${m.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {members.length === 0 && <p className="text-sm text-zinc-400">尚無成員</p>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="輸入成員名稱"
              value={addMemberName}
              onChange={e => setAddMemberName(e.target.value)}
            />
            <Button onClick={handleAddMember} disabled={addMemberLoading || !addMemberName.trim()} className="shrink-0 whitespace-nowrap">
              {addMemberLoading ? '…' : '新增'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Currencies dialog */}
      <Dialog open={currenciesOpen} onOpenChange={setCurrenciesOpen}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>幣別與匯率</DialogTitle>
            <DialogDescription>管理記帳本使用的幣別與匯率</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mb-4">
            {currencies.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-zinc-100 last:border-0">
                <span className="font-semibold text-zinc-900 w-12">{c.code}</span>
                {editingCurrencyCode === c.code ? (
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500 shrink-0">1 {c.code} =</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="匯率"
                        value={editingRate}
                        onChange={e => setEditingRate(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-zinc-500 shrink-0">TWD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500 shrink-0">小數位數</label>
                      <select
                        value={editingDecimals}
                        onChange={e => setEditingDecimals(e.target.value)}
                        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm"
                      >
                        <option value="0">0（整數）</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveRate(c.code)} disabled={savingRate}>
                        {savingRate ? '…' : '儲存'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingCurrencyCode(null); setEditingRate(''); setEditingDecimals('2') }}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-zinc-500 flex-1">
                      {c.exchange_rate
                        ? `1 ${c.code} = ${c.exchange_rate} TWD`
                        : '未設匯率'}
                      {` · ${c.decimal_places ?? 2}位小數`}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingCurrencyCode(c.code)
                        setEditingRate(c.exchange_rate ? String(c.exchange_rate) : '')
                        setEditingDecimals(String(c.decimal_places ?? 2))
                      }}
                    >
                      編輯
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
            <p className="text-xs font-medium text-zinc-600">新增幣別</p>
            <div className="flex gap-2">
              <Input
                placeholder="代碼，例：JPY"
                value={newCurrencyCode}
                onChange={e => setNewCurrencyCode(e.target.value.toUpperCase())}
                className="uppercase w-28"
              />
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="匯率（選填）"
                  value={newCurrencyRate}
                  onChange={e => setNewCurrencyRate(e.target.value)}
                />
                <span className="text-xs text-zinc-500 shrink-0">TWD</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-zinc-500 shrink-0">小數位數</label>
              <select
                value={newCurrencyDecimals}
                onChange={e => setNewCurrencyDecimals(e.target.value)}
                className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                <option value="0">0（整數）</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleAddCurrency}
              disabled={addCurrencyLoading || !newCurrencyCode.trim()}
            >
              {addCurrencyLoading ? '…' : '新增'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close/Reopen dialog */}
      <Dialog open={closeOpen} onOpenChange={open => { setCloseOpen(open); if (!open) { setPwOld(''); setPwNew(''); setPwError('') } }}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>管理記帳本</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <a href="https://travel-payment-zeta.vercel.app/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                另新增記帳本
              </Button>
            </a>

            {/* 角色密碼變更 */}
            {identity && (
              <div className="border-t border-zinc-100 pt-3 mt-1">
                <p className="text-sm font-medium text-zinc-700 mb-2">角色密碼變更</p>
                <div className="flex flex-col gap-2">
                  {members.find(m => m.name === identity)?.has_password && (
                    <Input
                      type="password"
                      placeholder="原密碼"
                      value={pwOld}
                      onChange={e => { setPwOld(e.target.value); setPwError('') }}
                    />
                  )}
                  <Input
                    type="password"
                    placeholder="新密碼"
                    value={pwNew}
                    onChange={e => { setPwNew(e.target.value); setPwError('') }}
                  />
                  {pwError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>
                  )}
                  <Button onClick={handlePasswordChange} disabled={pwSaving || !pwNew.trim()}>
                    {pwSaving ? '儲存中…' : '儲存密碼'}
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-100 pt-3 mt-1">
              <p className="text-sm font-medium text-zinc-700 mb-2">關閉記帳本</p>
              <p className="text-xs text-zinc-500 mb-3">請輸入建立記帳本的 Email 以驗證身份</p>
              <div className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="建立者 Email"
                  value={closeEmail}
                  onChange={e => { setCloseEmail(e.target.value); setCloseError('') }}
                />
                {closeError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{closeError}</p>
                )}
                <Button
                  onClick={handleCloseNotebook}
                  disabled={closeLoading || !closeEmail.trim()}
                  variant={notebook.is_closed ? 'default' : 'destructive'}
                >
                  {closeLoading ? '處理中…' : notebook.is_closed ? '重新開啟記帳本' : '關閉記帳本'}
                </Button>
              </div>
            </div>
          </div>
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-900 flex-1">{notebook.title}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCloseOpen(true); setCloseError('') }}
              className="text-xs"
            >
              管理
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs"
            >
              {copied ? '✓ 已複製' : '複製分享連結'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-500">
            <button
              onClick={() => setMembersOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 border border-zinc-200 hover:border-indigo-300 px-2.5 py-1 text-xs font-medium transition-colors"
            >
              👥 {members.length} 位成員
            </button>
            <span>·</span>
            <button
              onClick={() => setCurrenciesOpen(true)}
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              {currencies.map(c => (
                <Badge key={c.id} variant="default">{c.code}</Badge>
              ))}
            </button>
            {identity && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span className="text-indigo-600 font-medium">{identity}</span>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem(`notebook_identity_${id}`)
                      sessionStorage.removeItem(`notebook_pw_verified_${id}`)
                      setIdentity(null)
                      setPasswordVerified(false)
                      resetIdentityDialog()
                      setIdentityOpen(true)
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline ml-1"
                  >
                    [切換]
                  </button>
                </span>
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
          <ExpenseList expenses={expenses} identity={identity} notebookId={id} />
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

function ExpenseList({ expenses, identity, notebookId }: { expenses: Expense[]; identity: string | null; notebookId: string }) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-zinc-700 font-medium mb-3">還沒有費用</p>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left max-w-xs w-full shadow-sm">
          <p className="text-sm font-medium text-zinc-600 mb-2">開始使用步驟：</p>
          <ol className="text-sm text-zinc-500 flex flex-col gap-2 list-none">
            <li className="flex gap-2">
              <span className="shrink-0 font-semibold text-indigo-600">1.</span>
              <span>點「N 位成員」按鈕新增所有旅行成員</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-semibold text-indigo-600">2.</span>
              <span>點右下角「＋ 新增費用」開始記帳</span>
            </li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {expenses.map(expense => (
        <ExpenseCard key={expense.id} expense={expense} identity={identity} notebookId={notebookId} />
      ))}
    </div>
  )
}

function ExpenseCard({ expense, identity, notebookId }: { expense: Expense; identity: string | null; notebookId: string }) {
  const isOwn = expense.created_by === identity
  const isPrivate = expense.visibility === 'private'
  const router = useRouter()

  const dateStr = new Date(expense.date).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${isOwn && isPrivate ? 'border-indigo-100 bg-indigo-50/30' : ''}`}
      onClick={() => router.push(`/notebook/${notebookId}/expenses/${expense.id}/edit`)}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-zinc-900 truncate">{expense.title}</span>
              <Badge variant={isPrivate ? 'warning' : 'default'}>
                {isPrivate ? '個人' : '共同'}{expense.category ? ` · ${expense.category}` : ' · 無'}
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
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    fetch(`/api/notebooks/${notebookId}/collection`)
      .then(r => r.json())
      .then(setCollections)
      .catch(() => {})
  }, [notebookId])

  const myCollection = collections.find(c => c.member_name === identity)

  useEffect(() => {
    setAccountInfo(myCollection?.account_info ?? '')
    setNotes(myCollection?.notes ?? '')
    setQrPreview(myCollection?.qr_code_url ?? null)
    setQrFile(null)
    setEditing(false)
  }, [myCollection, identity])

  function handleQrChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setQrFile(file)
    setQrPreview(URL.createObjectURL(file))
    setUploadError('')
  }

  async function handleSave() {
    if (!identity) return
    setSaving(true)
    setUploadError('')
    try {
      let qrUrl = myCollection?.qr_code_url ?? null

      if (qrFile) {
        const form = new FormData()
        form.append('file', qrFile)
        form.append('notebook_id', notebookId)
        form.append('member_name', identity)
        const upRes = await fetch('/api/upload/qrcode', { method: 'POST', body: form })
        if (!upRes.ok) {
          const j = await upRes.json()
          setUploadError(j.error ?? 'QR Code 上傳失敗')
          setSaving(false)
          return
        }
        const { url } = await upRes.json()
        qrUrl = url
      }

      const res = await fetch(`/api/notebooks/${notebookId}/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name: identity, account_info: accountInfo, notes, qr_code_url: qrUrl }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCollections(prev => {
          const idx = prev.findIndex(c => c.member_name === identity)
          if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy }
          return [...prev, updated]
        })
        setEditing(false)
        setQrFile(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
                  <label className="text-xs font-medium text-zinc-500">備註</label>
                  <Input placeholder="其他說明" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-zinc-500">QR Code 圖片（選填）</label>
                  {qrPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrPreview} alt="QR Code 預覽" className="w-32 h-32 object-contain rounded-lg border border-zinc-200 bg-white" />
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors w-fit">
                      <span>📷</span>
                      <span>{qrPreview ? '更換圖片' : '上傳 QR Code'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleQrChange}
                      />
                    </label>
                    <p className="text-xs text-zinc-400">限圖片格式，1 MB 以內</p>
                  </div>
                  {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                </div>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? '儲存中…' : '儲存'}
                </Button>
              </div>
            ) : myCollection ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                  {myCollection.account_info || <span className="text-zinc-400">尚未填寫</span>}
                </p>
                {myCollection.notes && <p className="text-zinc-500 text-xs">{myCollection.notes}</p>}
                {myCollection.qr_code_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={myCollection.qr_code_url} alt="QR Code" className="w-32 h-32 object-contain rounded-lg border border-zinc-200 bg-white" />
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">尚未填寫收款資訊</p>
            )}
          </CardContent>
        </Card>
      )}

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
              <img src={c.qr_code_url} alt="QR Code" className="mt-2 w-32 h-32 object-contain rounded-lg border border-zinc-200 bg-white" />
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
