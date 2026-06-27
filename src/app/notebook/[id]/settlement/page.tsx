'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import type { Balance, SettlementItem, Currency, Expense } from '@/types'
import { formatTransferText } from '@/lib/settlement'
import { formatNum } from '@/lib/utils'
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
  const [identity, setIdentity] = useState<string | null>(null)
  const [privateExpenses, setPrivateExpenses] = useState<Expense[]>([])
  const [sharedExpenses, setSharedExpenses] = useState<Expense[]>([])

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

  useEffect(() => {
    const stored = sessionStorage.getItem(`notebook_identity_${id}`)
    if (stored) setIdentity(stored)
  }, [id])

  useEffect(() => {
    fetch(`/api/notebooks/${id}/expenses`)
      .then(r => r.json())
      .then((exps: Expense[]) => setSharedExpenses(exps))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!identity) return
    fetch(`/api/notebooks/${id}/expenses?created_by=${encodeURIComponent(identity)}`)
      .then(r => r.json())
      .then((exps: Expense[]) => setPrivateExpenses(exps.filter(e => e.visibility === 'private')))
      .catch(() => {})
  }, [id, identity])

  function findExchangeRate(currencyCode: string): { rate: number; base: string } | null {
    const c = currencies.find(c => c.code === currencyCode)
    if (c?.exchange_rate && c.base_currency && c.base_currency !== 'true' && c.base_currency !== 'false') {
      return { rate: c.exchange_rate, base: c.base_currency }
    }
    return null
  }

  function getDecimals(currencyCode: string): number {
    const c = currencies.find(c => c.code === currencyCode)
    return c?.decimal_places ?? 2
  }

  function handleCopy() {
    if (!data) return
    const decimalMap = Object.fromEntries(currencies.map(c => [c.code, c.decimal_places ?? 2]))

    // Group by currency (same as page display)
    const byCurr = data.transfers.reduce<Record<string, SettlementItem[]>>((acc, t) => {
      if (!acc[t.currency]) acc[t.currency] = []
      acc[t.currency].push(t)
      return acc
    }, {})
    // Sort within each currency by from_member (zh-TW, same as page)
    Object.values(byCurr).forEach(ts => ts.sort((a, b) => a.from_member.localeCompare(b.from_member, 'zh-TW')))
    // Currency order matches page allCurrencies
    const currOrder = [...new Set([
      ...data.balances.map(b => b.currency),
      ...data.transfers.map(t => t.currency),
    ])]
    const lines: string[] = []
    for (const curr of currOrder) {
      const items = byCurr[curr]
      if (!items?.length) continue
      if (lines.length > 0) lines.push('')
      lines.push(`【${curr}】`)
      const exchInfo = curr !== 'TWD' ? findExchangeRate(curr) : null
      const twdDp = getDecimals('TWD')
      for (const item of items) {
        const dp = decimalMap[item.currency] ?? 2
        const twdSuffix = exchInfo?.base === 'TWD'
          ? `（TWD＝${(item.amount * exchInfo.rate).toFixed(twdDp)}）`
          : ''
        lines.push(`${item.from_member} -> ${item.to_member}: ${item.amount.toFixed(dp)} ${item.currency}${twdSuffix}`)
      }
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownloadExcel() {
    if (!data) return
    const wb = XLSX.utils.book_new()

    for (const curr of allCurrencies) {
      const balances = balancesByCurrency[curr] ?? []
      const transfers = transfersByCurrency[curr] ?? []
      const exchInfo = findExchangeRate(curr)

      const dp = getDecimals(curr)
      const baseDp = exchInfo ? getDecimals(exchInfo.base) : 2
      const sheetData: (string | number)[][] = []

      // 收支明細
      if (balances.length > 0) {
        if (exchInfo) {
          sheetData.push(['【收支明細】', '', '', '', '', `1 ${curr} = ${exchInfo.rate} TWD`])
          sheetData.push(['成員', '已付', `已付(${exchInfo.base})`, '應付', `應付(${exchInfo.base})`, '淨額', `淨額(${exchInfo.base})`])
          for (const b of balances) {
            sheetData.push([
              b.member,
              Number(b.paid.toFixed(dp)),
              Number((b.paid * exchInfo.rate).toFixed(baseDp)),
              Number(b.owed.toFixed(dp)),
              Number((b.owed * exchInfo.rate).toFixed(baseDp)),
              Number(b.net.toFixed(dp)),
              Number((b.net * exchInfo.rate).toFixed(baseDp)),
            ])
          }
        } else {
          sheetData.push(['【收支明細】'])
          sheetData.push(['成員', '已付', '應付', '淨額'])
          for (const b of balances) {
            sheetData.push([
              b.member,
              Number(b.paid.toFixed(dp)),
              Number(b.owed.toFixed(dp)),
              Number(b.net.toFixed(dp)),
            ])
          }
        }
      }

      // 空行
      sheetData.push([])

      // 轉帳明細
      if (transfers.length > 0) {
        if (exchInfo) {
          sheetData.push(['【轉帳明細】'])
          sheetData.push(['付款人', '收款人', `金額(${curr})`, `金額(${exchInfo.base})`])
          for (const t of transfers) {
            sheetData.push([
              t.from_member,
              t.to_member,
              Number(t.amount.toFixed(dp)),
              Number((t.amount * exchInfo.rate).toFixed(baseDp)),
            ])
          }
        } else {
          sheetData.push(['【轉帳明細】'])
          sheetData.push(['付款人', '收款人', `金額(${curr})`])
          for (const t of transfers) {
            sheetData.push([t.from_member, t.to_member, Number(t.amount.toFixed(dp))])
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData)

      // Auto column widths
      const colWidths = sheetData.reduce<number[]>((widths, row) => {
        row.forEach((cell, i) => {
          const len = String(cell).length + 2
          widths[i] = Math.max(widths[i] ?? 8, len)
        })
        return widths
      }, [])
      ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 20) }))

      XLSX.utils.book_append_sheet(wb, ws, curr)
    }

    // 我的費用摘要 sheet
    if (identity && summaryAllCurrencies.length > 0) {
      const summaryData: (string | number)[][] = []
      summaryData.push([`【我的費用摘要 - ${identity}】`])

      for (const curr of summaryAllCurrencies) {
        const dp = getDecimals(curr)
        const catMap = privateExpensesByCurrencyAndCategory[curr] ?? {}
        const privTotal = privateExpensesByCurrency[curr] ?? 0
        const owed = myOwedByCurrency[curr] ?? 0

        summaryData.push([])
        summaryData.push([`▶ ${curr}`])
        summaryData.push(['項目', '金額'])

        for (const cat of CATEGORIES) {
          const amt = catMap[cat]
          if (amt) summaryData.push([`個人 - ${cat}`, Number(amt.toFixed(dp))])
        }
        if (privTotal > 0) summaryData.push(['個人小計', Number(privTotal.toFixed(dp))])
        if (owed > 0) summaryData.push(['共同分攤（應付）', Number(owed.toFixed(dp))])
        summaryData.push(['合計', Number((privTotal + owed).toFixed(dp))])
      }

      if (privateExpenses.length > 0) {
        summaryData.push([])
        summaryData.push(['【個人費用明細】'])
        summaryData.push(['日期', '費用名稱', '分類', '幣別', '金額', '備註'])
        for (const e of privateExpenses) {
          const dp = getDecimals(e.currency)
          summaryData.push([e.date, e.title, e.category || '無', e.currency, Number(e.amount.toFixed(dp)), e.notes ?? ''])
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(summaryData)
      const colWidths = summaryData.reduce<number[]>((widths, row) => {
        row.forEach((cell, i) => {
          const len = String(cell).length + 2
          widths[i] = Math.max(widths[i] ?? 8, len)
        })
        return widths
      }, [])
      ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 20) }))
      XLSX.utils.book_append_sheet(wb, ws, '我的摘要')
    }

    // 共同分攤明細 sheet（flat，每分攤人員一列，方便樞紐分析）
    if (sharedExpenses.length > 0) {
      const sharedData: (string | number)[][] = []
      sharedData.push(['日期', '費用名稱', '分攤人員', '分類', '幣別', '金額', '付款人', '備註'])
      for (const e of sharedExpenses) {
        const dp = getDecimals(e.currency)
        const cat = e.category || '無'
        const splits = e.splits ?? []
        if (splits.length > 0) {
          for (const s of splits) {
            sharedData.push([e.date, e.title, s.member_name, cat, e.currency, Number(s.amount.toFixed(dp)), e.payer, e.notes ?? ''])
          }
        } else {
          // 無分攤資料時保留費用總列
          sharedData.push([e.date, e.title, '', cat, e.currency, Number(e.amount.toFixed(dp)), e.payer, e.notes ?? ''])
        }
      }
      const wsShared = XLSX.utils.aoa_to_sheet(sharedData)
      const sharedColWidths = sharedData.reduce<number[]>((widths, row) => {
        row.forEach((cell, i) => {
          const len = String(cell).length + 2
          widths[i] = Math.max(widths[i] ?? 8, len)
        })
        return widths
      }, [])
      wsShared['!cols'] = sharedColWidths.map(w => ({ wch: Math.min(w, 25) }))
      XLSX.utils.book_append_sheet(wb, wsShared, '共同分攤明細')
    }

    XLSX.writeFile(wb, '結算明細.xlsx')
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
  Object.values(transfersByCurrency).forEach(ts => ts.sort((a, b) => a.from_member.localeCompare(b.from_member, 'zh-TW')))

  const CATEGORIES = ['食', '住', '行', '其他', '無']

  // 個人費用 by currency + category
  const privateExpensesByCurrencyAndCategory = privateExpenses.reduce<Record<string, Record<string, number>>>((acc, e) => {
    const cat = e.category || '無'
    if (!acc[e.currency]) acc[e.currency] = {}
    acc[e.currency][cat] = (acc[e.currency][cat] ?? 0) + e.amount
    return acc
  }, {})

  // 個人費用總計 by currency
  const privateExpensesByCurrency = Object.entries(privateExpensesByCurrencyAndCategory).reduce<Record<string, number>>((acc, [curr, cats]) => {
    acc[curr] = Object.values(cats).reduce((s, v) => s + v, 0)
    return acc
  }, {})

  // 共同分攤應付 by currency (from current user's balance)
  const myOwedByCurrency = identity
    ? Object.keys(balancesByCurrency).reduce<Record<string, number>>((acc, curr) => {
        const myBalance = balancesByCurrency[curr].find(b => b.member === identity)
        if (myBalance && myBalance.owed > 0) acc[curr] = myBalance.owed
        return acc
      }, {})
    : {}

  const summaryAllCurrencies = [...new Set([
    ...Object.keys(privateExpensesByCurrency),
    ...Object.keys(myOwedByCurrency),
  ])]

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
                          {balances.map(b => {
                            const dp = getDecimals(curr)
                            const baseDp = exchInfo ? getDecimals(exchInfo.base) : 2
                            return (
                            <tr key={b.member} className="border-b border-zinc-50 last:border-0">
                              <td className="py-2.5 font-medium text-zinc-800">{b.member}</td>
                              <td className="py-2.5 text-right text-zinc-600">
                                {formatNum(b.paid, dp)}
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {formatNum(b.paid * exchInfo.rate, baseDp)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-right text-zinc-600">
                                {formatNum(b.owed, dp)}
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {formatNum(b.owed * exchInfo.rate, baseDp)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-right">
                                <span className={b.net >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                  {b.net >= 0 ? '+' : ''}{formatNum(b.net, dp)}
                                </span>
                                {exchInfo && (
                                  <div className="text-xs text-zinc-400">
                                    ≈ {formatNum(b.net * exchInfo.rate, baseDp)} {exchInfo.base}
                                  </div>
                                )}
                              </td>
                            </tr>
                            )
                          })}
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
                      {transfers.map((t, idx) => {
                        const dp = getDecimals(curr)
                        const baseDp = exchInfo ? getDecimals(exchInfo.base) : 2
                        return (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-zinc-800">{t.from_member}</span>
                            <span className="text-zinc-400">→</span>
                            <span className="font-medium text-zinc-800">{t.to_member}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-zinc-900">
                              {curr} {formatNum(t.amount, dp)}
                            </span>
                            {exchInfo && (
                              <div className="text-xs text-zinc-400">
                                ≈ {formatNum(t.amount * exchInfo.rate, baseDp)} {exchInfo.base}
                              </div>
                            )}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )
        })}

        {/* 我的費用摘要 */}
        {identity && summaryAllCurrencies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>我的費用摘要（{identity}）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-5">
                {summaryAllCurrencies.map(curr => {
                  const dp = getDecimals(curr)
                  const catMap = privateExpensesByCurrencyAndCategory[curr] ?? {}
                  const privTotal = privateExpensesByCurrency[curr] ?? 0
                  const owed = myOwedByCurrency[curr] ?? 0
                  const total = privTotal + owed
                  const exchInfo = findExchangeRate(curr)
                  const baseDp = exchInfo ? getDecimals(exchInfo.base) : 2

                  const activeCats = CATEGORIES.filter(cat => catMap[cat] > 0)

                  return (
                    <div key={curr}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default" className="text-xs px-2 py-0.5">{curr}</Badge>
                        {exchInfo && <span className="text-xs text-zinc-400">1 {curr} = {exchInfo.rate} {exchInfo.base}</span>}
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {activeCats.map(cat => {
                            const amt = catMap[cat]
                            return (
                              <tr key={cat} className="border-b border-zinc-50">
                                <td className="py-1.5 text-zinc-500 pl-2">個人費用 · {cat}</td>
                                <td className="py-1.5 text-right text-zinc-700">
                                  {formatNum(amt, dp)}
                                  {exchInfo && (
                                    <span className="text-xs text-zinc-400 ml-1">≈{formatNum(amt * exchInfo.rate, baseDp)} {exchInfo.base}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {privTotal > 0 && activeCats.length > 1 && (
                            <tr className="border-b border-zinc-100">
                              <td className="py-1.5 text-zinc-500 pl-2 font-medium">個人小計</td>
                              <td className="py-1.5 text-right font-medium text-zinc-700">
                                {formatNum(privTotal, dp)}
                                {exchInfo && (
                                  <span className="text-xs text-zinc-400 ml-1">≈{formatNum(privTotal * exchInfo.rate, baseDp)} {exchInfo.base}</span>
                                )}
                              </td>
                            </tr>
                          )}
                          {owed > 0 && (
                            <tr className="border-b border-zinc-50">
                              <td className="py-1.5 text-zinc-500 pl-2">共同分攤（應付）</td>
                              <td className="py-1.5 text-right text-zinc-700">
                                {formatNum(owed, dp)}
                                {exchInfo && (
                                  <span className="text-xs text-zinc-400 ml-1">≈{formatNum(owed * exchInfo.rate, baseDp)} {exchInfo.base}</span>
                                )}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="pt-2 font-semibold text-zinc-900 pl-2">合計</td>
                            <td className="pt-2 text-right font-semibold text-zinc-900">
                              {formatNum(total, dp)}
                              {exchInfo && (
                                <span className="text-xs text-zinc-400 ml-1">≈{formatNum(total * exchInfo.rate, baseDp)} {exchInfo.base}</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {data && data.transfers.length > 0 && (
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleDownloadExcel}
            >
              下載 Excel
            </Button>

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
