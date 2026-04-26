'use client'
import { useState } from 'react'

const YEAR = 2026
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

type Deal = {
  id: string
  title: string
  calc_logic: string
  ratio: number
  direct_note?: string | null
}

type ExistingKpi = {
  performance_deal_id: string
  month: number
  kpi_value: number
  direct_cost: number
}

export default function KpiSelfForm({
  deals,
  existingKpi,
  salary,
}: {
  deals: Deal[]
  existingKpi: ExistingKpi[]
  salary: number
}) {
  const currentMonth = new Date().getMonth() + 1
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [values, setValues] = useState<Record<string, { kpi: string; direct: string }>>(() => {
    const init: Record<string, { kpi: string; direct: string }> = {}
    deals.forEach(d => {
      const ex = existingKpi.find(k => k.performance_deal_id === d.id && k.month === currentMonth)
      init[d.id] = { kpi: ex ? String(ex.kpi_value) : '', direct: ex ? String(ex.direct_cost) : '' }
    })
    return init
  })

  function handleMonthChange(m: number) {
    setSelectedMonth(m)
    const next: Record<string, { kpi: string; direct: string }> = {}
    deals.forEach(d => {
      const ex = existingKpi.find(k => k.performance_deal_id === d.id && k.month === m)
      next[d.id] = { kpi: ex ? String(ex.kpi_value) : '', direct: ex ? String(ex.direct_cost) : '' }
    })
    setValues(next)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    for (const deal of deals) {
      const v = values[deal.id]
      if (!v?.kpi) continue
      await fetch('/api/kpi/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          year: YEAR,
          month: selectedMonth,
          kpiValue: parseFloat(v.kpi || '0'),
          directCost: parseFloat(v.direct || '0'),
        }),
      })
    }
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="space-y-5">
      {/* 입력 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 space-y-1">
        <p className="font-semibold">📌 KPI 입력 안내</p>
        <ul className="text-xs text-blue-600 space-y-0.5 mt-1">
          <li>· <strong>KPI 값</strong>: 해당 월의 실적 금액 (단위: 백만원). 성과거래의 산출 로직에 따라 입력하세요.</li>
          <li>· <strong>직접비</strong>: KPI 달성을 위해 직접 지출한 비용 (없으면 0 또는 빈칸)</li>
          <li>· 입력하면 아래에 <strong>번돈 · 남는돈 · 배수</strong>가 즉시 미리보기됩니다.</li>
          <li>· 저장 후 관리자가 매입비를 반영하면 최종 E머니가 확정됩니다.</li>
        </ul>
      </div>

      {/* 월 선택 */}
      <div className="flex gap-2 flex-wrap">
        {MONTHS.map(m => (
          <button key={m} onClick={() => handleMonthChange(m)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedMonth === m ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:border-blue-400'
            }`}>
            {m}월
          </button>
        ))}
      </div>

      {/* 거래별 입력 카드 */}
      {deals.map(deal => {
        const v = values[deal.id] || { kpi: '', direct: '' }
        const kpiNum = parseFloat(v.kpi || '0') || 0
        const directNum = parseFloat(v.direct || '0') || 0
        const earned = kpiNum * deal.ratio
        const spent = directNum
        const remaining = earned - spent
        const multiplier = salary * 2 > 0 ? remaining / (salary * 2) : 0

        return (
          <div key={deal.id} className="bg-white rounded-xl border p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-900">{deal.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {deal.calc_logic} · 비율 <span className="text-blue-600 font-medium">{(deal.ratio * 100).toFixed(0)}%</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  KPI 값 <span className="text-gray-400">(백만원)</span>
                </label>
                <input
                  type="number"
                  value={v.kpi}
                  onChange={e => { setValues(prev => ({ ...prev, [deal.id]: { ...prev[deal.id], kpi: e.target.value } })); setSaved(false) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="예: 494"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  직접비 {deal.direct_note
                    ? <span className="text-orange-500">= {deal.direct_note}</span>
                    : <span className="text-gray-400">(선택)</span>}
                </label>
                <input
                  type="number"
                  value={v.direct}
                  onChange={e => { setValues(prev => ({ ...prev, [deal.id]: { ...prev[deal.id], direct: e.target.value } })); setSaved(false) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="예: 50"
                />
              </div>
            </div>

            {/* 실시간 계산 미리보기 */}
            {kpiNum > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="text-gray-400">번돈</p>
                  <p className="font-semibold text-blue-600 text-sm mt-0.5">{fmt(earned)}</p>
                </div>
                <div>
                  <p className="text-gray-400">쓴돈</p>
                  <p className="font-semibold text-red-400 text-sm mt-0.5">{fmt(spent)}</p>
                </div>
                <div>
                  <p className="text-gray-400">남는돈</p>
                  <p className={`font-semibold text-sm mt-0.5 ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(remaining)}</p>
                </div>
                <div>
                  <p className="text-gray-400">배수</p>
                  <p className={`font-semibold text-sm mt-0.5 ${multiplier >= 1 ? 'text-emerald-600' : 'text-gray-500'}`}>{fmt(multiplier)}x</p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? '저장 중...' : `${selectedMonth}월 KPI 저장`}
        </button>
        {saved && <span className="text-emerald-600 text-sm font-medium">✓ 저장 완료 — 관리자 검토 후 최종 반영됩니다</span>}
      </div>
    </div>
  )
}
