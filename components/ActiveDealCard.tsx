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

  const partner = deal.partner
  const partnerAffCode = partner?.affiliation?.code ?? partner?.affiliation?.[0]?.code

  const affColor = partnerAffCode === 'TC' ? 'bg-blue-100 text-blue-700'
    : partnerAffCode === 'SAVI' ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'

  function handleCancel() {
    setMode('view')
    setTitle(deal.title)
    setCalcLogic(deal.calc_logic)
    setRatio(String(Math.round(deal.ratio * 100)))
  }

  async function handleSave() {
    if (!partner) {
      alert('매입자 정보가 없어 변경 요청을 보낼 수 없습니다.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/proposals/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: partner.id,
        title,
        calc_logic: calcLogic,
        ratio: parseFloat(ratio) / 100,
        proposal_type: 'modify',
        related_deal_id: deal.id,
      }),
    })
    setSaving(false)
    if (res.ok) {
      alert(`${partner.name}님에게 변경 승인 요청을 보냈습니다.`)
      setMode('view')
      router.refresh()
    } else {
      alert('변경 요청 전송 실패')
    }
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
      <div className="bg-white rounded-xl border-2 border-amber-200 p-5">
        <p className="text-xs font-semibold text-amber-600 mb-1">거래 변경 요청</p>
        {partner && (
          <p className="text-xs text-gray-400 mb-4">
            변경 내용은 <strong className="text-gray-600">{partner.name}</strong>님의 승인 후 반영됩니다
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">거래 제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">산출 로직</label>
              <input
                value={calcLogic}
                onChange={e => setCalcLogic(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비율 (%)</label>
              <input
                type="number"
                value={ratio}
                onChange={e => setRatio(e.target.value)}
                min="0" max="100" step="0.1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? '전송 중...' : '승인 요청 보내기'}
            </button>
            <button
              onClick={handleCancel}
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
            {partner ? (
              <>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${affColor}`}>{partnerAffCode}</span>
                <span className="text-xs text-gray-500">매입: {partner.name}</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">매입자 미지정</span>
            )}
            <p className="text-xs text-gray-400 ml-auto">{new Date(deal.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-1">
            {calcLogic} · <span className="text-blue-600 font-medium">{ratio}%</span>
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setMode('edit')}
            className="text-xs border border-amber-300 text-amber-600 px-3 py-1 rounded hover:bg-amber-50 transition-colors"
          >
            변경요청
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
