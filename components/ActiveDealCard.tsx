'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ActiveDealCard({ deal }: { deal: any }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState(deal.title)
  const [calcLogic, setCalcLogic] = useState(deal.calc_logic)
  const [ratio, setRatio] = useState(String(Math.round(deal.ratio * 100)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, calc_logic: calcLogic, ratio: parseFloat(ratio) / 100 }),
    })
    setSaving(false)
    if (res.ok) { setMode('view'); router.refresh() }
    else alert('저장 실패')
  }

  async function handleDelete() {
    if (!confirm(`"${deal.title}" 거래를 삭제하시겠습니까?`)) return
    setDeleting(true)
    await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    setDeleting(false)
    router.refresh()
  }

  if (mode === 'edit') {
    return (
      <div className="bg-white rounded-xl border-2 border-blue-200 p-5">
        <p className="text-xs font-semibold text-blue-600 mb-4">거래 변경</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">거래 제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">산출 로직</label>
              <input
                value={calcLogic}
                onChange={e => setCalcLogic(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비율 (%)</label>
              <input
                type="number"
                value={ratio}
                onChange={e => setRatio(e.target.value)}
                min="0" max="100" step="0.1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => { setMode('view'); setTitle(deal.title); setCalcLogic(deal.calc_logic); setRatio(String(Math.round(deal.ratio * 100))) }}
              className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">활성</span>
            <p className="text-xs text-gray-400">{new Date(deal.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-1">
            {calcLogic} · <span className="text-blue-600 font-medium">{ratio}%</span>
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setMode('edit')}
            className="text-xs border border-blue-300 text-blue-600 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            변경
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? '...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
