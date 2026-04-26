'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const YEAR = 2026

type Deal = {
  id: string
  title: string
  calc_logic: string
  ratio: number
  employee: {
    id: string
    name: string
    salary: number
    affiliation: { code: string }
  }
}

type KpiRow = {
  performance_deal_id: string
  year: number
  month: number
  kpi_value: number
  direct_cost: number
  purchase_cost: number
  external_purchase_cost: number
}

export default function KpiForm({ deals, existingKpi }: { deals: Deal[], existingKpi: KpiRow[] }) {
  const [selectedMonth, setSelectedMonth] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 초기값 세팅
  const [values, setValues] = useState<Record<string, { kpi: string, direct: string, purchase: string, external: string }>>(() => {
    const init: Record<string, { kpi: string, direct: string, purchase: string, external: string }> = {}
    deals.forEach(d => {
      const existing = existingKpi.find(k => k.performance_deal_id === d.id && k.month === selectedMonth)
      init[d.id] = {
        kpi: existing ? String(existing.kpi_value) : '',
        direct: existing ? String(existing.direct_cost) : '',
        purchase: existing ? String(existing.purchase_cost) : '',
        external: existing ? String(existing.external_purchase_cost ?? 0) : '',
      }
    })
    return init
  })

  function handleMonthChange(m: number) {
    setSelectedMonth(m)
    const next: Record<string, { kpi: string, direct: string, purchase: string, external: string }> = {}
    deals.forEach(d => {
      const existing = existingKpi.find(k => k.performance_deal_id === d.id && k.month === m)
      next[d.id] = {
        kpi: existing ? String(existing.kpi_value) : '',
        direct: existing ? String(existing.direct_cost) : '',
        purchase: existing ? String(existing.purchase_cost) : '',
        external: existing ? String(existing.external_purchase_cost ?? 0) : '',
      }
    })
    setValues(next)
    setSaved(false)
  }

  function handleChange(dealId: string, field: 'kpi' | 'direct' | 'purchase' | 'external', val: string) {
    setValues(prev => ({ ...prev, [dealId]: { ...prev[dealId], [field]: val } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createSupabaseBrowser()
    const upserts = deals
      .filter(d => values[d.id]?.kpi !== '')
      .map(d => ({
        performance_deal_id: d.id,
        year: YEAR,
        month: selectedMonth,
        kpi_value: parseFloat(values[d.id]?.kpi || '0'),
        direct_cost: parseFloat(values[d.id]?.direct || '0'),
        purchase_cost: parseFloat(values[d.id]?.purchase || '0'),
        external_purchase_cost: parseFloat(values[d.id]?.external || '0'),
      }))

    const { error } = await supabase
      .from('monthly_kpi')
      .upsert(upserts, { onConflict: 'performance_deal_id,year,month' })

    setSaving(false)
    if (!error) setSaved(true)
    else alert('저장 실패: ' + error.message)
  }

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex gap-2 flex-wrap">
        {MONTHS.map(m => (
          <button
            key={m}
            onClick={() => handleMonthChange(m)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedMonth === m
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:border-blue-400'
            }`}
          >
            {m}월
          </button>
        ))}
      </div>

      {/* 입력 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">소속</th>
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">성과거래</th>
              <th className="px-4 py-3 text-left">산출로직</th>
              <th className="px-4 py-3 text-right">KPI 값</th>
              <th className="px-4 py-3 text-right">직접비</th>
              <th className="px-4 py-3 text-right">내부매입</th>
              <th className="px-4 py-3 text-right text-orange-600">외부매입</th>
              <th className="px-4 py-3 text-right text-blue-600">번돈 (예상)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map(d => {
              const v = values[d.id] || { kpi: '', direct: '', purchase: '' }
              const kpiNum = parseFloat(v.kpi || '0')
              const earned = kpiNum * d.ratio
              return (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      d.employee?.affiliation?.code === 'TC' ? 'bg-blue-100 text-blue-700' :
                      d.employee?.affiliation?.code === 'SAVI' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>{d.employee?.affiliation?.code}</span>
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">{d.employee?.name}</td>
                  <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate text-xs">{d.title}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{d.calc_logic} ({(d.ratio * 100).toFixed(0)}%)</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={v.kpi}
                      onChange={e => handleChange(d.id, 'kpi', e.target.value)}
                      className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={v.direct}
                      onChange={e => handleChange(d.id, 'direct', e.target.value)}
                      className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={v.purchase}
                      onChange={e => handleChange(d.id, 'purchase', e.target.value)}
                      className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={v.external}
                      onChange={e => handleChange(d.id, 'external', e.target.value)}
                      className="w-20 text-right border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-blue-600">
                    {v.kpi ? earned.toFixed(1) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : `${selectedMonth}월 데이터 저장`}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ 저장 완료</span>}
      </div>
    </div>
  )
}
