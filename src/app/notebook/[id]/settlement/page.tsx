'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Balance, SettlementItem, Currency } from '@/types'
import { formatTransferText } from '@/lib/settlement'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SettlementData {
  balances: Balance[]
  transfers: SettlementItem[]
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export default function SettlementPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const [data, setData] = useState<SettlementData | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [settlementRes, notebookRes] = await Promise.all([
        fetch(`/api/notebooks/${id}/settlement`),
        fetch(`/api/notebooks/${id}`),
      ])

      if (!settlementRes.ok) {
        setError('載入失敗')
        return
      }

      const settlementJson: SettlementData = await settlementRes.json()
      setData(settlementJson)

      if (notebookRes.ok) {
        const notebookJson = await notebookRes.json()
        setCurrencies(notebookJson.currencies ?? [])
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  function findExchangeRate(currencyCode: string): { rate: number; base: string } | null {
    const c = currencies.find(c => c.code === currencyCode)
    if (c?.exchange_rate && c.base_currency) {
      return { rate: c.exchange_rate, base: c.base_currency }
    }
    return null
  }

  function handleCopy() {
    if (!data) return
    const text = formatTransferText(data.transfers)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleSave() {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notebooks/${id}/settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfers: data.transfers }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const json = await res.json()
        setError(json.error ?? '儲存失敗')
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setSaving(false)
    }
  }

  // Group balances by currency
  const balancesByCurrency = data?.balances.reduce<Record<string, Balance[]>>((acc, b) => {
    if (!acc[b.currency]) acc[b.currency] = []
    acc[b.currency].push(b)
    return acc
  }, {}) ?? {}

  const transfersByCurrency = data?.transfers.reduce<Record<string, SettlementItem[]>>((acc, t) => {
    if (!acc[t.currency]) acc[t.currency] = []
    acc[t.currency].push(t)
    return acc
  }, {}) ?? {}

  if (loading) return <div className="min-h-screen bg-zinc-50"><Spinner /></div>
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <p className="text-zinc-500">{error}</p>
      </div>
    )
  }

  const allCurrencies = [...new Set([
    ...Object.keys(balancesByCurrency),
    ...Object.keys(transfersByCurrency),
  ])]

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push(`/notebook/${id}`)}
            className="text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="font-semibold text-zinc-900">結算</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {allCurrencies.length === 0 && (
          <div className="text-center py-20 text-zinc-400">尚無費用可結算</div>
        )}

        {allCurrencies.map(curr => {
          const balances = balancesByCurrency[curr] ?? []
          const transfers = transfersByCurrency[curr] ?? []
          const exchInfo = findExchangeRate(curr)

          return (
            <div key={curr} className="flex flex-col gap-4">
              {/* Currency header */}
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-sm px-3 py-1">{curr}</Badge>
                {exchInfo && (
                  <span className="text-xs text-zinc-400">
                    1 {curr} = {exchInfo.rate} TWD
                  </span>
                )}
              </div>

              {/* Balance table */}
              {balances.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>收支明細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100">
                            <th className="text-left py-2 font-medium text-zinc-500">成員</th>
                            <th className="text-right py-2 font-medium text-zinc-500">已付</th>
                            <th className="text-right py-2 font-medium text-zinc-500">應付</th>
                            <th className="text-right py-2 font-medium text-zinc-500">淨額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balances.map(b => (
                            <tr key={b.member} className="border-b border-zinc-50 last:border-0">
                              <td className="py-2.5 font-medium text-zinc-800">{b.member}</td>
                              <td className="py-2.5 text-right text-zinc-600">
                                {b.paid.toFixed(2)}
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {(b.paid * exchInfo.rate).toFixed(2)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-right text-zinc-600">
                                {b.owed.toFixed(2)}
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {(b.owed * exchInfo.rate).toFixed(2)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-right">
                                <span className={b.net >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                  {b.net >= 0 ? '+' : ''}{b.net.toFixed(2)}
                                </span>
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {(b.net * exchInfo.rate).toFixed(2)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transfers */}
              {transfers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>轉帳明細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      {transfers.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-zinc-800">{t.from_member}</span>
                            <span className="text-zinc-400">→</span>
                            <span className="font-medium text-zinc-800">{t.to_member}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-zinc-900">
                              {curr} {t.amount.toFixed(2)}
                            </span>
                            {exchInfo && (
                              <div className="text-xs text-zinc-400">
                                ≈ {(t.amount * exchInfo.rate).toFixed(2)} {exchInfo.base}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )
        })}

        {/* Actions */}
        {data && data.transfers.length > 0 && (
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleCopy}
            >
              {copied ? '✓ 已複製' : '複製 LINE 文字'}
            </Button>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '儲存中…' : saved ? '✓ 已儲存' : '儲存結算'}
            </Button>

            {saved && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/notebook/${id}/remittance`)}
              >
                前往匯款追蹤 →
              </Button>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-400 pb-2">
          超過 14 天未開啟記帳本，資料將自動刪除
        </p>
      </div>
    </div>
  )
}
