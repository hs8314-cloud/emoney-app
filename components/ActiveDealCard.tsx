'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export default function ActiveDealCard({ deal, salary }: { deal: any; salary: number }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState(deal.title)
  const [calcLogic, setCalcLogic] = useState(deal.calc_logic)
  const [ratio, setRatio] = useState(String(Math.round(deal.ratio * 100)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 내용조회
  const [showDetail, setShowDetail] = useState(false)
  const [kpiRows, setKpiRows] = useState<any[]>([])
  const [loadingKpi, setLoadingKpi] = useState(false)

  const partner = deal.partner
  const partnerAffCode = partner?.affiliation?.code ?? partner?.affiliation?.[0]?.code
  const affColor = partnerAffCode === 'TC' ? 'bg-blue-100 text-blue-700'
    : partnerAffCode === 'SAVI' ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'

  async function handleToggleDetail() {
    if (showDetail) { setShowDetail(false); return }
    setLoadingKpi(true)
    setShowDetail(true)
    const supabase = createSupabaseBrowser()
    const { data } = await supabase
      .from('monthly_kpi')
      .select('*')
      .eq('performance_deal_id', deal.id)
      .eq('year', 2026)
      .order('month')
    setKpiRows(data || [])
    setLoadingKpi(false)
  }

  function handleCancel() {
    setMode('view')
    setTitle(deal.title)
    setCalcLogic(deal.calc_logic)
    setRatio(String(Math.round(deal.ratio * 100)))
  }

  async function handleSave() {
    if (!partner) { alert('매입자 정보가 없어 변경 요청을 보낼 수 없습니다.'); return }
    setSaving(true)
    const res = await fetch('/api/proposals/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: partner.id,
        title, calc_logic: calcLogic,
        ratio: parseFloat(ratio) / 100,
        proposal_type: 'modify',
        related_deal_id: deal.id,
      }),
    })
    setSaving(false)
    if (res.ok) { alert(`${partner.name}님에게 변경 승인 요청을 보냈습니다.`); setMode('view'); router.refresh() }
    else alert('변경 요청 전송 실패')
  }

  async function handleDelete() {
    if (!confirm(`"${deal.title}" 거래를 삭제하시겠습니까?`)) return
    setDeleting(true)
    await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    setDeleting(false)
    router.refresh()
  }

  // 월별 계산
  const monthly = kpiRows.map(r => {
    const earned = r.kpi_value * deal.ratio
    const spent = r.direct_cost + r.purchase_cost
    const remaining = earned - spent
    const multiplier = salary * 2 > 0 ? remaining / (salary * 2) : 0
    return { month: r.month, kpiValue: r.kpi_value, earned, spent, remaining, multiplier }
  })
  const cumEarned = monthly.reduce((s, m) => s + m.earned, 0)
  const cumSpent = monthly.reduce((s, m) => s + m.spent, 0)
  const cumRemaining = cumEarned - cumSpent
  const cumMultiplier = salary * 2 * monthly.length > 0 ? cumRemaining / (salary * 2 * monthly.length) : 0

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
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">산출 로직</label>
              <input value={calcLogic} onChange={e => setCalcLogic(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비율 (%)</label>
              <input type="number" value={ratio} onChange={e => setRatio(e.target.value)}
                min="0" max="100" step="0.1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
              {saving ? '전송 중...' : '승인 요청 보내기'}
            </button>
            <button onClick={handleCancel}
              className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* 카드 헤더 */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
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
          <div className="flex gap-2 ml-4 flex-shrink-0">
            <button onClick={handleToggleDetail}
              className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50 transition-colors">
              {showDetail ? '닫기' : '내용조회'}
            </button>
            <button onClick={() => setMode('edit')}
              className="text-xs border border-amber-300 text-amber-600 px-3 py-1 rounded hover:bg-amber-50 transition-colors">
              변경요청
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="text-xs border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting ? '...' : '삭제'}
            </button>
          </div>
        </div>
      </div>

      {/* 월별 KPI 상세 */}
      {showDetail && (
        <div className="border-t bg-gray-50 px-5 py-4">
          {loadingKpi ? (
            <p className="text-sm text-gray-400 text-center py-4">불러오는 중...</p>
          ) : monthly.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">입력된 KPI 데이터가 없습니다</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">2026년 월별 성과 · 단위: 백만원</p>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr className="border-b border-gray-200">
                    <th className="py-1.5 text-left">월</th>
                    <th className="py-1.5 text-right">KPI 값</th>
                    <th className="py-1.5 text-right">번돈</th>
                    <th className="py-1.5 text-right">쓴돈</th>
                    <th className="py-1.5 text-right font-semibold text-gray-600">남는돈</th>
                    <th className="py-1.5 text-right">배수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthly.map(m => (
                    <tr key={m.month}>
                      <td className="py-2 text-gray-600 font-medium">{m.month}월</td>
                      <td className="py-2 text-right text-gray-500">{fmt(m.kpiValue)}</td>
                      <td className="py-2 text-right text-blue-600">{fmt(m.earned)}</td>
                      <td className="py-2 text-right text-red-400">{fmt(m.spent)}</td>
                      <td className={`py-2 text-right font-bold ${m.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt(m.remaining)}
                      </td>
                      <td className={`py-2 text-right ${m.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {fmt(m.multiplier)}x
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 text-sm font-semibold">
                  <tr>
                    <td className="pt-2 text-gray-700">누적</td>
                    <td></td>
                    <td className="pt-2 text-right text-blue-600">{fmt(cumEarned)}</td>
                    <td className="pt-2 text-right text-red-400">{fmt(cumSpent)}</td>
                    <td className={`pt-2 text-right font-bold ${cumRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(cumRemaining)}
                    </td>
                    <td className={`pt-2 text-right ${cumMultiplier >= 1 ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {fmt(cumMultiplier)}x
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
