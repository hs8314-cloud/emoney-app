'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const AFF_COLOR: Record<string, string> = {
  TC: 'bg-blue-100 text-blue-700',
  SAVI: 'bg-purple-100 text-purple-700',
  EV: 'bg-green-100 text-green-700',
}

export default function AdminTabs({
  employees,
  activeDeals,
  months,
  isExporter,
  allEmployees,
}: {
  employees: any[]
  activeDeals: any[]
  months: number[]
  isExporter: boolean
  allEmployees: any[]
}) {
  const tabs = [
    { key: 'summary', label: '전체 합계' },
    { key: 'deals', label: '성과거래' },
    ...(isExporter ? [
      { key: 'empinfo', label: '직원정보' },
      { key: 'export', label: '데이터 내보내기' },
    ] : []),
  ] as const

  type TabKey = 'summary' | 'deals' | 'empinfo' | 'export'
  const [tab, setTab] = useState<TabKey>('summary')
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  // 중단처리: 월 선택 UI
  const [stopSelectId, setStopSelectId] = useState<string | null>(null)
  const [stopEndMonth, setStopEndMonth] = useState<number>(new Date().getMonth() + 1)
  // 비율변경 UI
  const [ratioChangeId, setRatioChangeId] = useState<string | null>(null)
  const [ratioChangeMonth, setRatioChangeMonth] = useState<number>(4)
  const [ratioChangeValue, setRatioChangeValue] = useState<string>('')
  const [ratioChanges, setRatioChanges] = useState<Record<string, Record<string, number>>>({}) // dealId -> {month: ratio}
  const [dealDetail, setDealDetail] = useState<Record<string, { loading: boolean; rows: any[] }>>({})
  // 셀 조회 상세: key = `${dealId}-${month}-${field}`
  const [openCell, setOpenCell] = useState<string | null>(null)
  const [cellData, setCellData] = useState<Record<string, any>>({})
  const [cellLoading, setCellLoading] = useState<string | null>(null)
  const router = useRouter()

  async function handleCellDetail(dealId: string, month: number, field: 'earned' | 'purchase' | 'external', row: any) {
    const key = `${dealId}-${month}-${field}`
    if (openCell === key) { setOpenCell(null); return }
    setOpenCell(key)
    if (cellData[key]) return  // 이미 로드됨

    setCellLoading(key)
    const supabase = createSupabaseBrowser()

    if (field === 'earned') {
      // 번돈: 계산식만 표시 (API 불필요)
      setCellData(prev => ({ ...prev, [key]: { type: 'earned', kpi: row.kpi_value, ratio: row._ratio, earned: row.earned } }))
    } else if (field === 'purchase') {
      // 내부매입: 기여 판매자 역계산 API
      const res = await fetch(`/api/admin/kpi/purchase-breakdown?dealId=${dealId}&year=2026&month=${month}`)
      const data = await res.json()
      setCellData(prev => ({ ...prev, [key]: data }))
    } else if (field === 'external') {
      // 외부매입: external_purchase_details 조회
      const { data } = await supabase
        .from('external_purchase_details')
        .select('description, amount')
        .eq('performance_deal_id', dealId)
        .eq('year', 2026)
        .eq('month', month)
        .order('created_at')
      setCellData(prev => ({ ...prev, [key]: { items: data || [] } }))
    }
    setCellLoading(null)
  }

  async function handleToggleDetail(dealId: string, ratio: number) {
    if (dealDetail[dealId]?.rows.length > 0) {
      setDealDetail(prev => ({ ...prev, [dealId]: { loading: false, rows: [] } }))
      return
    }
    setDealDetail(prev => ({ ...prev, [dealId]: { loading: true, rows: [] } }))
    const supabase = createSupabaseBrowser()
    const { data } = await supabase
      .from('monthly_kpi')
      .select('month, kpi_value, direct_cost, purchase_cost, external_purchase_cost')
      .eq('performance_deal_id', dealId)
      .eq('year', 2026)
      .order('month')
    const rows = (data || []).map(r => {
      const earned = r.kpi_value * ratio
      const spent = r.direct_cost + r.purchase_cost + (r.external_purchase_cost ?? 0)
      return { ...r, earned, spent, remaining: earned - spent, _ratio: ratio }
    })
    setDealDetail(prev => ({ ...prev, [dealId]: { loading: false, rows } }))
  }

  async function handleStopConfirm(dealId: string) {
    setStoppingId(dealId)
    setStopSelectId(null)
    await fetch(`/api/admin/deals/${dealId}/stop`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endMonth: stopEndMonth }),
    })
    setStoppingId(null)
    router.refresh()
  }

  async function handleDeleteDeal(dealId: string, title: string) {
    if (!confirm(`"${title}" 거래를 완전히 삭제하시겠습니까?\n\n입력된 KPI 데이터도 함께 삭제됩니다.`)) return
    setStopSelectId(null)
    await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleRatioChangeSave(dealId: string) {
    const newRatio = parseFloat(ratioChangeValue) / 100
    if (isNaN(newRatio) || newRatio <= 0) { alert('유효한 비율을 입력하세요'); return }
    const res = await fetch(`/api/admin/deals/${dealId}/ratio`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMonth: ratioChangeMonth, ratio: newRatio }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRatioChanges(prev => ({ ...prev, [dealId]: data.ratio_changes }))
      setRatioChangeId(null)
      setRatioChangeValue('')
    } else {
      alert(`저장 실패 (${res.status}): ${data.error ?? '알 수 없는 오류'}`)
    }
  }

  async function handleRatioChangeDelete(dealId: string, fromMonth: number) {
    const res = await fetch(`/api/admin/deals/${dealId}/ratio`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMonth }),
    })
    const data = await res.json()
    if (res.ok) setRatioChanges(prev => ({ ...prev, [dealId]: data.ratio_changes }))
    else alert(`삭제 실패: ${data.error ?? ''}`)
  }

  // 누적 계산
  function cumCalc(empMonths: Record<number, any>, salary: number) {
    const earned = months.reduce((s, m) => s + (empMonths[m]?.earned ?? 0), 0)
    const spent = months.reduce((s, m) => s + (empMonths[m]?.spent ?? 0), 0)
    const remaining = earned - spent
    const monthCount = months.filter(m => empMonths[m] !== undefined).length
    const multiplier = salary * 2 * monthCount > 0 ? remaining / (salary * 2 * monthCount) : 0
    return { earned, spent, remaining, multiplier }
  }

  // CSV 내보내기
  function handleExport() {
    const headers = ['소속', '이름', ...months.flatMap(m => [`${m}월 번돈`, `${m}월 쓴돈`, `${m}월 남는돈`, `${m}월 배수`]), '누적 번돈', '누적 쓴돈', '누적 남는돈', '누적 배수']
    const rows = employees.map(emp => {
      const cum = cumCalc(emp.months, emp.salary)
      return [
        emp.affiliation,
        emp.name,
        ...months.flatMap(m => {
          const d = emp.months[m]
          return [
            d ? fmt(d.earned) : '0',
            d ? fmt(d.spent) : '0',
            d ? fmt(d.remaining) : '0',
            d ? fmt(d.multiplier) + 'x' : '0x',
          ]
        }),
        fmt(cum.earned),
        fmt(cum.spent),
        fmt(cum.remaining),
        fmt(cum.multiplier) + 'x',
      ]
    })

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `E머니_성과데이터_2026.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 전체 합계 행 + 배수 (분모: 전 직원 급여합 × 2 × 고정 개월수)
  function totalRow() {
    let totEarned = 0, totSpent = 0, totSalary = 0
    for (const emp of employees) {
      const cum = cumCalc(emp.months, emp.salary)
      totEarned += cum.earned
      totSpent += cum.spent
      totSalary += emp.salary
    }
    const totRemaining = totEarned - totSpent
    const denom = totSalary * 2 * months.length
    const totMultiplier = denom > 0 ? totRemaining / denom : 0
    return { earned: totEarned, spent: totSpent, remaining: totRemaining, multiplier: totMultiplier }
  }

  const total = totalRow()

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as TabKey)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 전체 합계 탭 */}
      {tab === 'summary' && (
        <div>
          {/* 총합 요약 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">전체 번돈 (누적)</p>
              <p className="text-xl font-bold text-blue-600">{fmt(total.earned)}</p>
              <p className="text-xs text-gray-400 mt-0.5">백만원</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">전체 쓴돈 (누적)</p>
              <p className="text-xl font-bold text-red-400">{fmt(total.spent)}</p>
              <p className="text-xs text-gray-400 mt-0.5">백만원</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">전체 남는돈 (누적)</p>
              <p className={`text-xl font-bold ${total.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(total.remaining)}</p>
              <p className="text-xs text-gray-400 mt-0.5">백만원</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">전체 배수 (누적)</p>
              <p className={`text-xl font-bold ${total.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-500'}`}>{fmt(total.multiplier)}x</p>
              <p className="text-xs text-gray-400 mt-0.5">남는돈 / 급여×2×개월</p>
            </div>
          </div>

          {/* 직원별 상세 테이블 */}
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto overflow-y-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 text-left sticky left-0 z-30 bg-gray-50">소속</th>
                  <th className="px-4 py-3 text-left sticky left-16 z-30 bg-gray-50">이름</th>
                  {months.map(m => (
                    <th key={m} colSpan={3} className="px-4 py-3 text-center border-l">{m}월</th>
                  ))}
                  <th colSpan={4} className="px-4 py-3 text-center border-l bg-blue-50">누적</th>
                </tr>
                <tr className="text-xs text-gray-400 border-t bg-gray-50">
                  <th className="px-4 py-2 sticky left-0 z-30 bg-gray-50"></th>
                  <th className="px-4 py-2 sticky left-16 z-30 bg-gray-50"></th>
                  {months.map(m => (
                    <>
                      <th key={`${m}-e`} className="px-3 py-2 text-right border-l">번돈</th>
                      <th key={`${m}-s`} className="px-3 py-2 text-right">쓴돈</th>
                      <th key={`${m}-r`} className="px-3 py-2 text-right">남는돈</th>
                    </>
                  ))}
                  <th className="px-3 py-2 text-right border-l bg-blue-50">번돈</th>
                  <th className="px-3 py-2 text-right bg-blue-50">쓴돈</th>
                  <th className="px-3 py-2 text-right bg-blue-50 font-semibold">남는돈</th>
                  <th className="px-3 py-2 text-right bg-blue-50 font-semibold">배수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp: any, i: number) => {
                  const cum = cumCalc(emp.months, emp.salary)
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${AFF_COLOR[emp.affiliation] ?? 'bg-gray-100 text-gray-600'}`}>
                          {emp.affiliation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 sticky left-16 bg-white">{emp.name}</td>
                      {months.map(m => {
                        const d = emp.months[m]
                        return (
                          <>
                            <td key={`${m}-e`} className="px-3 py-3 text-right text-blue-600 border-l">{d ? fmt(d.earned) : '-'}</td>
                            <td key={`${m}-s`} className="px-3 py-3 text-right text-red-400">{d ? fmt(d.spent) : '-'}</td>
                            <td key={`${m}-r`} className={`px-3 py-3 text-right font-medium ${!d ? 'text-gray-300' : d.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {d ? fmt(d.remaining) : '-'}
                            </td>
                          </>
                        )
                      })}
                      <td className="px-3 py-3 text-right text-blue-600 border-l bg-blue-50">{fmt(cum.earned)}</td>
                      <td className="px-3 py-3 text-right text-red-400 bg-blue-50">{fmt(cum.spent)}</td>
                      <td className={`px-3 py-3 text-right font-bold bg-blue-50 ${cum.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt(cum.remaining)}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold bg-blue-50 ${cum.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {fmt(cum.multiplier)}x
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* 합계 행 */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50">합계</td>
                  {months.map(m => {
                    const mEarned = employees.reduce((s, e) => s + (e.months[m]?.earned ?? 0), 0)
                    const mSpent = employees.reduce((s, e) => s + (e.months[m]?.spent ?? 0), 0)
                    const mRemaining = mEarned - mSpent
                    return (
                      <>
                        <td key={`tot-${m}-e`} className="px-3 py-3 text-right font-bold text-blue-600 border-l">{fmt(mEarned)}</td>
                        <td key={`tot-${m}-s`} className="px-3 py-3 text-right font-bold text-red-400">{fmt(mSpent)}</td>
                        <td key={`tot-${m}-r`} className={`px-3 py-3 text-right font-bold ${mRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(mRemaining)}</td>
                      </>
                    )
                  })}
                  <td className="px-3 py-3 text-right font-bold text-blue-600 border-l bg-blue-50">{fmt(total.earned)}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-400 bg-blue-50">{fmt(total.spent)}</td>
                  <td className={`px-3 py-3 text-right font-bold bg-blue-50 ${total.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(total.remaining)}</td>
                  <td className="px-3 py-3 bg-blue-50"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 성과거래 탭 */}
      {tab === 'deals' && (
        <div className="space-y-4 overflow-y-auto max-h-[700px] pr-1">
          {activeDeals.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">활성 거래가 없습니다</div>
          ) : (() => {
            // 사람별 그룹핑
            const grouped: Record<string, { emp: any; empAff: string; deals: any[] }> = {}
            for (const deal of activeDeals) {
              const empId = deal.employee_id ?? deal.employee?.name ?? 'unknown'
              const empAff = deal.employee?.affiliation?.code ?? deal.employee?.affiliation?.[0]?.code ?? ''
              if (!grouped[empId]) grouped[empId] = { emp: deal.employee, empAff, deals: [] }
              grouped[empId].deals.push(deal)
            }
            return Object.entries(grouped).map(([empId, group]) => (
              <div key={empId} className="rounded-xl border overflow-hidden bg-white">
                {/* 사람 헤더 */}
                <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${AFF_COLOR[group.empAff] ?? 'bg-gray-100 text-gray-600'}`}>{group.empAff}</span>
                  <span className="font-semibold text-gray-800">{group.emp?.name}</span>
                  <span className="text-xs text-gray-400 ml-1">거래 {group.deals.length}건</span>
                </div>
                {/* 해당 사람의 거래 목록 */}
                <div className="divide-y divide-gray-100">
                {group.deals.map((deal: any) => {
            const partnerAff = deal.partner?.affiliation?.code ?? deal.partner?.affiliation?.[0]?.code
            return (
              <div key={deal.id} className="overflow-hidden">
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {deal.is_active ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">활성</span>
                      ) : (
                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded font-medium">중단</span>
                      )}
                      {deal.partner ? (
                        <>
                          <span className="text-xs text-gray-400">매입 →</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${AFF_COLOR[partnerAff] ?? 'bg-gray-100 text-gray-600'}`}>{partnerAff}</span>
                          <span className="text-sm text-gray-600">{deal.partner?.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">매입자 미지정</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{deal.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {deal.calc_logic}
                    </p>
                    {/* 기간별 비율 표시 */}
                    {(() => {
                      const changes = ratioChanges[deal.id] ?? deal.ratio_changes ?? {}
                      const entries = Object.entries(changes)
                        .map(([m, r]) => ({ m: Number(m), r: Number(r) }))
                        .sort((a, b) => a.m - b.m)
                      const startMonth = deal.start_month ?? 1
                      const endMonth = deal.end_month ?? 12

                      // 구간 목록 생성: [{from, to, ratio}]
                      const segments: { from: number; to: number; ratio: number }[] = []
                      let prev = startMonth
                      for (const { m, r } of entries) {
                        if (m > prev) segments.push({ from: prev, to: m - 1, ratio: deal.ratio })
                        prev = m
                        const nextM = entries.find(e => e.m > m)?.m ?? (endMonth + 1)
                        segments.push({ from: m, to: nextM - 1, ratio: r })
                        prev = nextM
                      }
                      if (entries.length === 0) segments.push({ from: startMonth, to: endMonth, ratio: deal.ratio })

                      return (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                          {segments.map((seg, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                              ${i === 0 && entries.length === 0 ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                              {seg.from === seg.to ? `${seg.from}월` : `${seg.from}~${seg.to}월`}
                              &nbsp;{(seg.ratio * 100).toFixed(0)}%
                              {/* 변경 구간은 × 삭제 버튼 */}
                              {entries.find(e => e.m === seg.from) && (
                                <button onClick={() => handleRatioChangeDelete(deal.id, seg.from)}
                                  className="text-blue-300 hover:text-red-500 font-bold leading-none ml-0.5">×</button>
                              )}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                    <p className="text-xs text-gray-400">{new Date(deal.created_at).toLocaleDateString('ko-KR')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleDetail(deal.id, deal.ratio)}
                        className="text-xs border border-blue-300 text-blue-600 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        {dealDetail[deal.id]?.rows.length > 0 ? '닫기' : '거래내용조회'}
                      </button>
                      {ratioChangeId === deal.id ? (
                        <div className="flex items-center gap-1">
                          <select value={ratioChangeMonth} onChange={e => setRatioChangeMonth(Number(e.target.value))}
                            className="text-xs border border-amber-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400">
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월~</option>)}
                          </select>
                          <input type="number" value={ratioChangeValue} onChange={e => setRatioChangeValue(e.target.value)}
                            placeholder="%" min="0" max="100" step="0.1"
                            className="w-14 text-xs border border-amber-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                          <span className="text-xs text-gray-400">%</span>
                          <button onClick={() => handleRatioChangeSave(deal.id)}
                            className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600">저장</button>
                          <button onClick={() => { setRatioChangeId(null); setRatioChangeValue('') }}
                            className="text-xs border border-gray-300 text-gray-500 px-2 py-1 rounded hover:bg-gray-50">취소</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRatioChangeId(deal.id); setRatioChangeMonth(new Date().getMonth() + 1); setRatioChangeValue('') }}
                          className="text-xs border border-amber-300 text-amber-600 px-3 py-1 rounded hover:bg-amber-50 transition-colors"
                        >
                          비율변경
                        </button>
                      )}
                      {stopSelectId === deal.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1">
                            <select
                              value={stopEndMonth}
                              onChange={e => setStopEndMonth(Number(e.target.value))}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-300"
                            >
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                <option key={m} value={m}>{m}월까지</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStopConfirm(deal.id)}
                              disabled={stoppingId === deal.id}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setStopSelectId(null)}
                              className="text-xs border border-gray-300 text-gray-500 px-2 py-1 rounded hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteDeal(deal.id, deal.title)}
                            className="text-xs text-red-400 hover:text-red-600 underline transition-colors"
                          >
                            🗑 거래 완전삭제
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setStopSelectId(deal.id); setStopEndMonth(new Date().getMonth() + 1) }}
                          disabled={stoppingId === deal.id}
                          className="text-xs border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {stoppingId === deal.id ? '중단 중...' : '중단처리'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 월별 실적 상세 */}
                {dealDetail[deal.id] && (
                  <div className="border-t bg-gray-50 px-5 py-4">
                    {dealDetail[deal.id].loading ? (
                      <p className="text-sm text-gray-400 text-center py-3">불러오는 중...</p>
                    ) : dealDetail[deal.id].rows.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">입력된 KPI 데이터가 없습니다</p>
                    ) : (() => {
                      const rows = dealDetail[deal.id].rows
                      const totEarned = rows.reduce((s, r) => s + r.earned, 0)
                      const totDirect = rows.reduce((s, r) => s + r.direct_cost, 0)
                      const totPurchase = rows.reduce((s, r) => s + r.purchase_cost, 0)
                      const totExternal = rows.reduce((s, r) => s + (r.external_purchase_cost ?? 0), 0)
                      const totSpent = rows.reduce((s, r) => s + r.spent, 0)
                      const totRemaining = rows.reduce((s, r) => s + r.remaining, 0)
                      return (
                        <>
                          <p className="text-xs text-gray-400 mb-3">2026년 월별 실적 · 단위: 백만원</p>
                          <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500">
                              <tr className="border-b border-gray-200">
                                <th className="py-1.5 text-left">월</th>
                                <th className="py-1.5 text-right">KPI값</th>
                                <th className="py-1.5 text-right text-blue-600">번돈</th>
                                <th className="py-1.5 text-right">직접비</th>
                                <th className="py-1.5 text-right">내부매입</th>
                                <th className="py-1.5 text-right text-orange-500">외부매입</th>
                                <th className="py-1.5 text-right text-red-400">쓴돈계</th>
                                <th className="py-1.5 text-right font-semibold text-gray-700">남는돈</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {rows.map(r => {
                                const earnedKey = `${deal.id}-${r.month}-earned`
                                const purchaseKey = `${deal.id}-${r.month}-purchase`
                                const externalKey = `${deal.id}-${r.month}-external`
                                return (
                                <>
                                <tr key={r.month} className="hover:bg-white">
                                  <td className="py-2 text-gray-600 font-medium">{r.month}월</td>
                                  <td className="py-2 text-right text-gray-500">{fmt(r.kpi_value)}</td>
                                  <td className="py-2 text-right">
                                    <span className="text-blue-600 font-medium">{fmt(r.earned)}</span>
                                    <button onClick={() => handleCellDetail(deal.id, r.month, 'earned', r)} className={`ml-1 text-xs transition-colors ${openCell === earnedKey ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}>🔍</button>
                                  </td>
                                  <td className="py-2 text-right text-gray-400">{fmt(r.direct_cost)}</td>
                                  <td className="py-2 text-right">
                                    <span className="text-gray-400">{fmt(r.purchase_cost)}</span>
                                    {r.purchase_cost !== 0 && <button onClick={() => handleCellDetail(deal.id, r.month, 'purchase', r)} className={`ml-1 text-xs transition-colors ${openCell === purchaseKey ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}>🔍</button>}
                                  </td>
                                  <td className="py-2 text-right">
                                    <span className="text-orange-500">{fmt(r.external_purchase_cost ?? 0)}</span>
                                    {(r.external_purchase_cost ?? 0) !== 0 && <button onClick={() => handleCellDetail(deal.id, r.month, 'external', r)} className={`ml-1 text-xs transition-colors ${openCell === externalKey ? 'text-orange-500' : 'text-gray-300 hover:text-orange-400'}`}>🔍</button>}
                                  </td>
                                  <td className="py-2 text-right text-red-400">{fmt(r.spent)}</td>
                                  <td className={`py-2 text-right font-bold ${r.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(r.remaining)}</td>
                                </tr>
                                {/* 셀 조회 상세 행 */}
                                {(openCell === earnedKey || openCell === purchaseKey || openCell === externalKey) && (() => {
                                  const activeKey = openCell!
                                  const d = cellData[activeKey]
                                  const isLoading = cellLoading === activeKey
                                  return (
                                    <tr key={`detail-${r.month}`} className="bg-blue-50">
                                      <td colSpan={8} className="px-3 py-2.5">
                                        {isLoading ? (
                                          <span className="text-xs text-gray-400">불러오는 중...</span>
                                        ) : !d ? null : openCell === earnedKey ? (
                                          <span className="text-xs text-blue-700">
                                            KPI <strong>{fmt(d.kpi)}</strong> × 비율 <strong>{(d.ratio * 100).toFixed(0)}%</strong> = <strong>{fmt(d.earned)}</strong> 백만원
                                          </span>
                                        ) : openCell === purchaseKey ? (
                                          <div className="text-xs space-y-0.5">
                                            {d.type === 'seller' ? (
                                              <span className="text-gray-600">→ <strong>{d.partnerName}</strong>에게 지급: <strong className="text-orange-600">{fmt(d.amount)}</strong> 백만원</span>
                                            ) : d.sellers?.length === 0 ? (
                                              <span className="text-gray-400">기여 판매자 없음</span>
                                            ) : (
                                              <>
                                                {d.sellers.map((s: any) => (
                                                  <div key={s.name} className="flex gap-2 text-gray-600">
                                                    <span className="w-16 font-medium">{s.name}</span>
                                                    <span className="text-gray-400">{s.isFullEarned ? '번돈 전액' : '남는돈'}</span>
                                                    <span className="text-orange-600 font-medium">+{fmt(s.contribution)}</span>
                                                  </div>
                                                ))}
                                                <div className="pt-0.5 border-t border-blue-200 text-gray-700 font-semibold">합계 {fmt(d.total)} 백만원</div>
                                              </>
                                            )}
                                          </div>
                                        ) : openCell === externalKey ? (
                                          <div className="text-xs space-y-0.5">
                                            {d.items?.length === 0 ? (
                                              <span className="text-gray-400">상세 내역 없음 (KPI 입력 폼에서 항목 추가 가능)</span>
                                            ) : (
                                              <>
                                                {d.items.map((item: any, i: number) => (
                                                  <div key={i} className="flex gap-3 text-gray-600">
                                                    <span className="flex-1">{item.description}</span>
                                                    <span className="text-orange-600 font-medium">{fmt(item.amount)} 백만</span>
                                                  </div>
                                                ))}
                                              </>
                                            )}
                                          </div>
                                        ) : null}
                                      </td>
                                    </tr>
                                  )
                                })()}
                                </>
                              )})}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-300 text-sm font-semibold">
                              <tr>
                                <td className="pt-2 text-gray-700">누적</td>
                                <td></td>
                                <td className="pt-2 text-right text-blue-600">{fmt(totEarned)}</td>
                                <td className="pt-2 text-right text-gray-400">{fmt(totDirect)}</td>
                                <td className="pt-2 text-right text-gray-400">{fmt(totPurchase)}</td>
                                <td className="pt-2 text-right text-orange-500">{fmt(totExternal)}</td>
                                <td className="pt-2 text-right text-red-400">{fmt(totSpent)}</td>
                                <td className={`pt-2 text-right font-bold ${totRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(totRemaining)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* 직원정보 탭 */}
      {tab === 'empinfo' && isExporter && (
        <EmployeeInfoTab allEmployees={allEmployees} />
      )}

      {/* 내보내기 탭 (고형석만) */}
      {tab === 'export' && isExporter && (
        <ExportTab />
      )}
    </div>
  )
}

// ─── 직원정보 편집 탭 ────────────────────────────────────────────
function EmployeeInfoTab({ allEmployees }: { allEmployees: any[] }) {
  type EmpRow = {
    id: string; name: string; affCode: string; email: string
    employee_no: string; grade: string; position_title: string
  }
  const [rows, setRows] = useState<EmpRow[]>(allEmployees)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<EmpRow>>({})
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const AFF_COLOR: Record<string, string> = {
    TC: 'bg-blue-100 text-blue-700',
    EV: 'bg-green-100 text-green-700',
    SAVI: 'bg-purple-100 text-purple-700',
  }

  function startEdit(emp: EmpRow) {
    setEditId(emp.id)
    setDraft({ employee_no: emp.employee_no, grade: emp.grade, position_title: emp.position_title })
    setSavedId(null)
  }

  function cancelEdit() { setEditId(null); setDraft({}) }

  async function saveEdit(empId: string) {
    setSaving(true)
    const res = await fetch(`/api/admin/employees/${empId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setSaving(false)
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === empId ? { ...r, ...draft } as EmpRow : r))
      setEditId(null)
      setDraft({})
      setSavedId(empId)
      setTimeout(() => setSavedId(null), 2000)
    } else {
      alert('저장 실패')
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">직원정보 편집</h3>
          <p className="text-xs text-gray-400 mt-0.5">사번 · 직급 · 직책을 입력하면 AMIS 엑셀 내보내기 시 자동 반영됩니다.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 border-b">
            <tr>
              <th className="px-4 py-3 text-left">소속</th>
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">이메일</th>
              <th className="px-4 py-3 text-left">사번 <span className="text-blue-400">(H열)</span></th>
              <th className="px-4 py-3 text-left">직급 <span className="text-blue-400">(I열)</span></th>
              <th className="px-4 py-3 text-left">직책 <span className="text-blue-400">(J열)</span></th>
              <th className="px-4 py-3 text-center">편집</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(emp => {
              const isEditing = editId === emp.id
              return (
                <tr key={emp.id} className={`border-b ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${AFF_COLOR[emp.affCode] ?? 'bg-gray-100 text-gray-500'}`}>
                      {emp.affCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{emp.email}</td>
                  {isEditing ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={draft.employee_no ?? ''} onChange={e => setDraft(d => ({ ...d, employee_no: e.target.value }))}
                          className="w-28 border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="예: 202301" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={draft.grade ?? ''} onChange={e => setDraft(d => ({ ...d, grade: e.target.value }))}
                          className="w-20 border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="예: 상무" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={draft.position_title ?? ''} onChange={e => setDraft(d => ({ ...d, position_title: e.target.value }))}
                          className="w-32 border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="예: 탕콤 공장장" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => saveEdit(emp.id)} disabled={saving}
                            className="bg-amber-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-amber-600 disabled:opacity-50">
                            {saving ? '...' : '저장'}
                          </button>
                          <button onClick={cancelEdit}
                            className="border border-gray-300 text-gray-500 px-3 py-1 rounded text-xs hover:bg-gray-50">
                            취소
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-gray-600">{emp.employee_no || <span className="text-gray-300">미입력</span>}</td>
                      <td className="px-4 py-2.5 text-gray-600">{emp.grade || <span className="text-gray-300">미입력</span>}</td>
                      <td className="px-4 py-2.5 text-gray-600">{emp.position_title || <span className="text-gray-300">미입력</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        {savedId === emp.id ? (
                          <span className="text-emerald-500 text-xs font-medium">✓ 저장됨</span>
                        ) : (
                          <button onClick={() => startEdit(emp)}
                            className="text-xs border border-gray-300 text-gray-500 px-3 py-1 rounded hover:bg-gray-50 transition-colors">
                            편집
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── AMIS 형식 엑셀 내보내기 탭 ────────────────────────────────
function ExportTab() {
  const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const currentMonth = new Date().getMonth() + 1
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/admin/export/excel?year=2026&month=${selectedMonth}`)
      if (!res.ok) { alert('다운로드 실패'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `동남아_개인수지업로드_2026년${selectedMonth}월.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-8 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">데이터 내보내기</h3>
        <p className="text-sm text-gray-500">AMIS 이셀수지표(라인) 형식으로 엑셀 파일을 다운로드합니다.</p>
      </div>

      {/* 월 선택 */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">월 선택</p>
        <div className="flex gap-2 flex-wrap">
          {MONTHS.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedMonth === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-600 hover:border-blue-400'
              }`}>
              {m}월
            </button>
          ))}
        </div>
      </div>

      {/* 포함 데이터 안내 */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">포함 데이터 (AMIS L~P 열)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
          <span><strong className="text-gray-700">L열 번돈(매총익)</strong> — KPI × 비율</span>
          <span><strong className="text-gray-700">M열 쓴돈(합계)</strong> — 직접비 + 매입비</span>
          <span><strong className="text-gray-700">N열 직접비</strong> — 직접비 + 외부매입</span>
          <span><strong className="text-gray-700">O열 매입비</strong> — 매입자 지급액</span>
          <span><strong className="text-gray-700">P열 남는돈</strong> — L − M</span>
          <span><strong className="text-gray-700">Q열 세금(24.2%)</strong> — P × 24.2%</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">A~K 열(법인·이름·email 등)은 보유 데이터 기준으로 채워집니다.</p>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {downloading ? (
          <><span className="animate-spin">⏳</span> 생성 중...</>
        ) : (
          <>📊 AMIS 엑셀 다운로드 ({selectedMonth}월)</>
        )}
      </button>
    </div>
  )
}
