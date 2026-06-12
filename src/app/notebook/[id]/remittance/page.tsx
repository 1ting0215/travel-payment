'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { SettlementItem, CollectionInfo, RemittanceStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

const STATUS_LABELS: Record<RemittanceStatus, string> = {
  unpaid: '未付款',
  paid: '已付款',
  confirmed: '已確認',
}

const STATUS_NEXT: Record<RemittanceStatus, RemittanceStatus> = {
  unpaid: 'paid',
  paid: 'confirmed',
  confirmed: 'unpaid',
}

const STATUS_VARIANT: Record<RemittanceStatus, 'destructive' | 'warning' | 'success'> = {
  unpaid: 'destructive',
  paid: 'warning',
  confirmed: 'success',
}

export default function RemittancePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const [transfers, setTransfers] = useState<SettlementItem[]>([])
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [identity, setIdentity] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [settlementRes, collectionRes] = await Promise.all([
        fetch(`/api/notebooks/${id}/settlement`),
        fetch(`/api/notebooks/${id}/collection`),
      ])

      if (settlementRes.ok) {
        const json = await settlementRes.json()
        setTransfers(json.transfers ?? [])
      }
      if (collectionRes.ok) {
        setCollections(await collectionRes.json())
      }
    } catch {
      setError('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const stored = localStorage.getItem(`notebook_identity_${id}`)
    if (stored) setIdentity(stored)
    fetchData()
  }, [id, fetchData])

  async function handleStatusUpdate(item: SettlementItem) {
    const nextStatus = STATUS_NEXT[item.status]
    setUpdating(item.id)
    try {
      const res = await fetch(`/api/settlement/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        const updated: SettlementItem = await res.json()
        setTransfers(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
    } catch {
      setError('更新失敗')
    } finally {
      setUpdating(null)
    }
  }

  async function handleProofUpload(item: SettlementItem, file: File) {
    // Placeholder: in a real app this would upload to storage first
    // For now just mark as paid
    setUpdating(item.id)
    try {
      const res = await fetch(`/api/settlement/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', proof_url: null }),
      })
      if (res.ok) {
        const updated: SettlementItem = await res.json()
        setTransfers(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
    } finally {
      setUpdating(null)
    }
  }

  function getCollection(memberName: string): CollectionInfo | undefined {
    return collections.find(c => c.member_name === memberName)
  }

  if (loading) return <div className="min-h-screen bg-zinc-50"><Spinner /></div>

  const myOutgoing = transfers.filter(t => t.from_member === identity)
  const myIncoming = transfers.filter(t => t.to_member === identity)
  const otherTransfers = transfers.filter(t => t.from_member !== identity && t.to_member !== identity)

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
          <h1 className="font-semibold text-zinc-900">匯款追蹤</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {transfers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-sm">尚無結算記錄，請先進行結算</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.push(`/notebook/${id}/settlement`)}
            >
              前往結算
            </Button>
          </div>
        )}

        {/* My outgoing transfers */}
        {myOutgoing.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              我需要付款
            </h2>
            <div className="flex flex-col gap-3">
              {myOutgoing.map(item => (
                <TransferCard
                  key={item.id}
                  item={item}
                  collection={getCollection(item.to_member)}
                  isUpdating={updating === item.id}
                  onStatusUpdate={handleStatusUpdate}
                  onProofUpload={handleProofUpload}
                  showCollection
                />
              ))}
            </div>
          </section>
        )}

        {/* My incoming transfers */}
        {myIncoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              待收款
            </h2>
            <div className="flex flex-col gap-3">
              {myIncoming.map(item => (
                <TransferCard
                  key={item.id}
                  item={item}
                  collection={getCollection(item.to_member)}
                  isUpdating={updating === item.id}
                  onStatusUpdate={handleStatusUpdate}
                  onProofUpload={handleProofUpload}
                  showCollection={false}
                  canConfirm
                />
              ))}
            </div>
          </section>
        )}

        {/* All transfers */}
        {otherTransfers.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              其他轉帳
            </h2>
            <div className="flex flex-col gap-3">
              {otherTransfers.map(item => (
                <TransferCard
                  key={item.id}
                  item={item}
                  collection={getCollection(item.to_member)}
                  isUpdating={updating === item.id}
                  onStatusUpdate={handleStatusUpdate}
                  onProofUpload={handleProofUpload}
                  showCollection={false}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function TransferCard({
  item,
  collection,
  isUpdating,
  onStatusUpdate,
  onProofUpload,
  showCollection,
  canConfirm = false,
}: {
  item: SettlementItem
  collection: CollectionInfo | undefined
  isUpdating: boolean
  onStatusUpdate: (item: SettlementItem) => void
  onProofUpload: (item: SettlementItem, file: File) => void
  showCollection: boolean
  canConfirm?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex flex-col gap-3">
        {/* Transfer info */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-zinc-900">{item.from_member}</span>
              <span className="text-zinc-400">→</span>
              <span className="font-semibold text-zinc-900">{item.to_member}</span>
            </div>
            <p className="text-lg font-bold text-zinc-900 mt-1">
              {item.currency} {item.amount.toFixed(2)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[item.status]}>
            {STATUS_LABELS[item.status]}
          </Badge>
        </div>

        {/* Collection info */}
        {showCollection && collection && (
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3">
            <p className="text-xs font-medium text-zinc-500 mb-1">收款資訊</p>
            {collection.account_info && (
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{collection.account_info}</p>
            )}
            {collection.notes && (
              <p className="text-xs text-zinc-500 mt-1">{collection.notes}</p>
            )}
            {collection.qr_code_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={collection.qr_code_url}
                alt="QR Code"
                className="mt-2 w-28 h-28 object-contain rounded"
              />
            )}
            {!collection.account_info && !collection.qr_code_url && (
              <p className="text-sm text-zinc-400">收款方尚未填寫收款資訊</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusUpdate(item)}
            disabled={isUpdating}
          >
            {isUpdating ? '更新中…' : `標記為 ${STATUS_LABELS[STATUS_NEXT[item.status]]}`}
          </Button>

          {item.status === 'unpaid' && showCollection && (
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors">
                上傳付款憑證
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) onProofUpload(item, file)
                }}
              />
            </label>
          )}

          {item.proof_url && (
            <a
              href={item.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              查看憑證
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
