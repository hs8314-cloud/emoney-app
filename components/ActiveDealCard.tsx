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
  const [startMonth, setStartMonth] = useState(String(deal.start_month ?? 1))
  const [endMonth, setEndMonth] = useState(String(deal.end_month ?? 12))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 내용조회
  const [showDetail, setShowDetail] = useState(false)
  const [kpiRows, setKpiRows] = useState<any[]>([])
  const [loadingKpi, setLoadingKpi] = useState(false)

  // 셀 breakdown
  const [openCell, setOpenCell] = useState<string | null>(null)
  const [cellData, setCellData] = useState<Record<string, any>>({})
  const [cellLoading, setCellLoading] = useState<string | null>(null)

  const partner = deal.partner
  const partnerAffCode = partner?.affiliation?.code ?? partner?.affiliation?.[0]?.code
  const affColor = partnerAffCode === 'TC' ? 'bg-blue-100 text-blue-700'
    : partnerAffCode === 'SAVI' ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'

  async function handleCellClick(type: 'earned' | 'purchase', month: number, m: any) {
    const key = `${month}-${type}`
    if (openCell === key) { setOpenCell(null); return }
    setOpenCell(key)

    if (type === 'earned') {
      // 로컬 계산
      setCellData(prev => ({ ...prev, [key]: { kpiValue: m.kpiValue, kpiValue2: m.kpiValue2, ratio: deal.ratio, earned: m.earned } }))
      return
    }

    // 내부매입: API 조회
    if (m.purchase <= 0) {
      setCellData(prev => ({ ...prev, [key]: { sellers: [], total: 0 } }))
      return
    }
    setCellLoading(key)
    const res = await fetch(`/api/admin/kpi/purchase-breakdown?dealId=${deal.id}&year=2026&month=${month}`)
    const json = await res.json()
    setCellData(prev => ({ ...prev, [key]: json }))
    setCellLoading(null)
  }

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
    setStartMonth(String(deal.start_month ?? 1))
    setEndMonth(String(deal.end_month ?? 12))
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
        start_month: parseInt(startMonth),
        end_month: parseInt(endMonth),
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
    const kpi2 = r.kpi_value_2 ?? 0
    const kpi1 = deal.calc_type === 'product' && deal.kpi_1_percent ? r.kpi_value / 100 : r.kpi_value
    const earned = deal.calc_type === 'product'
      ? kpi1 * kpi2 * deal.ratio
      : r.kpi_value * deal.ratio
    const direct = r.direct_cost
    const purchase = r.purchase_cost
    const external = r.external_purchase_cost ?? 0
    const spent = direct + purchase + external
    const remaining = earned - spent
    const multiplier = salary * 2 > 0 ? remaining / (salary * 2) : 0
    return { month: r.month, kpiValue: r.kpi_value, kpiValue2: kpi2, earned, spent, remaining, multiplier, direct, purchase, external }
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작월</label>
              <select value={startMonth} onChange={e => setStartMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료월</label>
              <select value={endMonth} onChange={e => setEndMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
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

  const isStopped = !deal.is_active

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isStopped ? 'opacity-70' : ''}`}>
      {/* 카드 헤더 */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isStopped ? (
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded font-medium">거래중단</span>
              ) : (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">활성</span>
              )}
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
            <p className={`font-semibold ${isStopped ? 'text-gray-400' : 'text-gray-900'}`}>{title}</p>
            <p className="text-sm text-gray-500 mt-1">
              {calcLogic} · <span className={isStopped ? 'text-gray-400 font-medium' : 'text-blue-600 font-medium'}>{ratio}%</span>
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                {deal.start_month ?? 1}월~{deal.end_month ?? 12}월
              </span>
            </p>
          </div>
          <div className="flex gap-2 ml-4 flex-shrink-0">
            <button onClick={handleToggleDetail}
              className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50 transition-colors">
              {showDetail ? '닫기' : '내용조회'}
            </button>
            {!isStopped && (
              <>
                <button onClick={() => setMode('edit')}
                  className="text-xs border border-amber-300 text-amber-600 px-3 py-1 rounded hover:bg-amber-50 transition-colors">
                  변경요청
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50">
                  {deleting ? '...' : '삭제'}
                </button>
              </>
            )}
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
                    <th className="py-1.5 text-right">직접비</th>
                    <th className="py-1.5 text-right">내부매입</th>
                    <th className="py-1.5 text-right">쓴돈</th>
                    <th className="py-1.5 text-right font-semibold text-gray-600">남는돈</th>
                    <th className="py-1.5 text-right">배수</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map(m => {
                    const earnedKey = `${m.month}-earned`
                    const purchaseKey = `${m.month}-purchase`
                    return (
                      <>
                        <tr key={m.month} className="border-b border-gray-100">
                          <td className="py-2 text-gray-600 font-medium">{m.month}월</td>
                          <td className="py-2 text-right text-gray-500">{fmt(m.kpiValue)}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-blue-600">{fmt(m.earned)}</span>
                              <button onClick={() => handleCellClick('earned', m.month, m)}
                                className={`text-xs px-1 py-0.5 rounded transition-colors ${openCell === earnedKey ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-400'}`}>
                                🔍
                              </button>
                            </div>
                          </td>
                          <td className="py-2 text-right text-gray-400">
                            {m.direct > 0 ? (
                              <>
                                <span>{fmt(m.direct)}</span>
                                {deal.direct_note && <p className="text-xs text-gray-300">{deal.direct_note}</p>}
                              </>
                            ) : '-'}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-400">{m.purchase > 0 ? fmt(m.purchase) : '-'}</span>
                              {m.purchase > 0 && (
                                <button onClick={() => handleCellClick('purchase', m.month, m)}
                                  className={`text-xs px-1 py-0.5 rounded transition-colors ${openCell === purchaseKey ? 'bg-purple-100 text-purple-600' : 'text-gray-300 hover:text-purple-400'}`}>
                                  🔍
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-right text-red-400">{fmt(m.spent)}</td>
                          <td className={`py-2 text-right font-bold ${m.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {fmt(m.remaining)}
                          </td>
                          <td className={`py-2 text-right ${m.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {fmt(m.multiplier)}x
                          </td>
                        </tr>
                        {/* 번돈 상세 */}
                        {openCell === earnedKey && (
                          <tr key={`${m.month}-earned-detail`} className="bg-blue-50 border-b border-blue-100">
                            <td colSpan={8} className="px-3 py-2 text-xs text-blue-700">
                              {deal.calc_type === 'product' ? (
                                <><strong>{deal.kpi_label_1 ?? '납기준수율'}</strong> {fmt(m.kpiValue)}{deal.kpi_1_percent ? `% (×${fmt(m.kpiValue/100)})` : ''} × <strong>{deal.kpi_label_2 ?? '생산량'}</strong> {fmt(m.kpiValue2)} × <strong>{deal.ratio}백만원</strong> = <strong>{fmt(m.earned)}</strong> 백만원</>
                              ) : (
                                <>KPI <strong>{fmt(m.kpiValue)}</strong> × <strong>{(deal.ratio * 100).toFixed(0)}%</strong> = <strong>{fmt(m.earned)}</strong> 백만원</>
                              )}
                            </td>
                          </tr>
                        )}
                        {/* 내부매입 상세 */}
                        {openCell === purchaseKey && (
                          <tr key={`${m.month}-purchase-detail`} className="bg-purple-50 border-b border-purple-100">
                            <td colSpan={8} className="px-3 py-2 text-xs">
                              {cellLoading === purchaseKey ? (
                                <span className="text-gray-400">불러오는 중...</span>
                              ) : cellData[purchaseKey]?.sellers?.length > 0 ? (
                                <div className="space-y-0.5">
                                  {cellData[purchaseKey].sellers.map((s: any, i: number) => (
                                    <div key={i} className="flex justify-between text-purple-700">
                                      <span>{s.name} {s.isFullEarned ? '(번돈 전액)' : '(남는돈)'}</span>
                                      <span className="font-medium">{fmt(s.contribution)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between font-semibold text-purple-800 border-t border-purple-200 pt-0.5 mt-0.5">
                                    <span>합계</span>
                                    <span>{fmt(cellData[purchaseKey].total)}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">매입 내역 없음</span>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 text-sm font-semibold">
                  <tr>
                    <td className="pt-2 text-gray-700">누적</td>
                    <td></td>
                    <td className="pt-2 text-right text-blue-600">{fmt(cumEarned)}</td>
                    <td className="pt-2 text-right text-gray-400">{fmt(monthly.reduce((s,m)=>s+m.direct,0))}</td>
                    <td className="pt-2 text-right text-gray-400">{fmt(monthly.reduce((s,m)=>s+m.purchase,0))}</td>
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
