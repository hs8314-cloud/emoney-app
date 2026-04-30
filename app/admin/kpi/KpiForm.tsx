'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const YEAR = 2026

type Deal = {
  id: string
  title: string
  calc_logic: string
  ratio: number
  calc_type?: string | null
  kpi_label_1?: string | null
  kpi_label_2?: string | null
  kpi_1_percent?: boolean | null
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
  kpi_value_2?: number
  direct_cost: number
  purchase_cost: number
  external_purchase_cost: number
}

type ExItem = { id?: string; desc: string; amount: string }

export default function KpiForm({ deals, existingKpi }: { deals: Deal[], existingKpi: KpiRow[] }) {
  const [selectedMonth, setSelectedMonth] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settleResult, setSettleResult] = useState<{ buyer: string; amount: number }[] | null>(null)

  // 외부매입 상세 섹션 state
  const [exDealId, setExDealId] = useState<string>('')
  const [exItems, setExItems] = useState<ExItem[]>([])
  const [exLoadedKey, setExLoadedKey] = useState<string>('')
  const [exSaving, setExSaving] = useState(false)
  const [exSaved, setExSaved] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // 초기값 세팅
  const [values, setValues] = useState<Record<string, { kpi: string, kpi2: string, direct: string, purchase: string, external: string }>>(() => {
    const init: Record<string, { kpi: string, kpi2: string, direct: string, purchase: string, external: string }> = {}
    deals.forEach(d => {
      const existing = existingKpi.find(k => k.performance_deal_id === d.id && k.month === selectedMonth)
      init[d.id] = {
        kpi: existing ? String(existing.kpi_value) : '',
        kpi2: existing ? String(existing.kpi_value_2 ?? 0) : '',
        direct: existing ? String(existing.direct_cost) : '',
        purchase: existing ? String(existing.purchase_cost) : '',
        external: existing ? String(existing.external_purchase_cost ?? 0) : '',
      }
    })
    return init
  })

  function handleMonthChange(m: number) {
    setSelectedMonth(m)
    const next: Record<string, { kpi: string, kpi2: string, direct: string, purchase: string, external: string }> = {}
    deals.forEach(d => {
      const existing = existingKpi.find(k => k.performance_deal_id === d.id && k.month === m)
      next[d.id] = {
        kpi: existing ? String(existing.kpi_value) : '',
        kpi2: existing ? String(existing.kpi_value_2 ?? 0) : '',
        direct: existing ? String(existing.direct_cost) : '',
        purchase: existing ? String(existing.purchase_cost) : '',
        external: existing ? String(existing.external_purchase_cost ?? 0) : '',
      }
    })
    setValues(next)
    setSaved(false)
    // 월 바뀌면 외부매입 상세 리셋
    setExItems([])
    setExLoadedKey('')
    setExSaved(false)
  }

  // 외부매입 상세 로드 (거래 또는 월 변경 시)
  useEffect(() => {
    if (!exDealId) { setExItems([]); return }
    const key = `${exDealId}-${selectedMonth}`
    if (exLoadedKey === key) return
    const supabase = createSupabaseBrowser()
    supabase
      .from('external_purchase_details')
      .select('id, description, amount')
      .eq('performance_deal_id', exDealId)
      .eq('year', YEAR)
      .eq('month', selectedMonth)
      .order('created_at')
      .then(({ data }) => {
        setExItems((data || []).map((d: any) => ({ id: d.id, desc: d.description, amount: String(d.amount) })))
        setExLoadedKey(key)
      })
  }, [exDealId, selectedMonth])

  // exItems 합산 → 메인 테이블 external 값 동기화
  useEffect(() => {
    if (!exDealId || exLoadedKey !== `${exDealId}-${selectedMonth}`) return
    const total = exItems.reduce((s, i) => s + parseFloat(i.amount || '0'), 0)
    setValues(prev => ({ ...prev, [exDealId]: { ...prev[exDealId], external: String(total) } }))
  }, [exItems])

  function handleAddItem() {
    if (!newDesc.trim() || !newAmount) return
    setExItems(prev => [...prev, { desc: newDesc.trim(), amount: newAmount }])
    setNewDesc('')
    setNewAmount('')
    setExSaved(false)
  }

  function handleRemoveItem(idx: number) {
    setExItems(prev => prev.filter((_, i) => i !== idx))
    setExSaved(false)
  }

  async function handleExSave() {
    if (!exDealId) return
    setExSaving(true)
    const supabase = createSupabaseBrowser()
    const total = exItems.reduce((s, i) => s + parseFloat(i.amount || '0'), 0)

    // 기존 항목 삭제 후 재입력
    await supabase.from('external_purchase_details')
      .delete()
      .eq('performance_deal_id', exDealId)
      .eq('year', YEAR)
      .eq('month', selectedMonth)

    if (exItems.length > 0) {
      await supabase.from('external_purchase_details').insert(
        exItems.map(i => ({
          performance_deal_id: exDealId,
          year: YEAR,
          month: selectedMonth,
          description: i.desc,
          amount: parseFloat(i.amount || '0'),
        }))
      )
    }

    // monthly_kpi external_purchase_cost도 동기화
    const { data: existing } = await supabase
      .from('monthly_kpi')
      .select('id')
      .eq('performance_deal_id', exDealId)
      .eq('year', YEAR)
      .eq('month', selectedMonth)
      .maybeSingle()

    if (existing) {
      await supabase.from('monthly_kpi').update({ external_purchase_cost: total }).eq('id', existing.id)
    } else {
      await supabase.from('monthly_kpi').insert({
        performance_deal_id: exDealId, year: YEAR, month: selectedMonth,
        kpi_value: 0, direct_cost: 0, purchase_cost: 0, external_purchase_cost: total,
      })
    }

    setExLoadedKey(`${exDealId}-${selectedMonth}`)
    setExSaving(false)
    setExSaved(true)
  }

  function handleChange(dealId: string, field: 'kpi' | 'kpi2' | 'direct' | 'purchase' | 'external', val: string) {
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
        kpi_value_2: parseFloat(values[d.id]?.kpi2 || '0'),
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
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0 z-10">
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
          <tbody>
            {(() => {
              // 사람별 그룹핑
              const grouped: { empKey: string; emp: any; deals: typeof deals }[] = []
              const seen = new Set<string>()
              for (const d of deals) {
                const key = d.employee?.id ?? d.employee?.name ?? 'unknown'
                if (!seen.has(key)) {
                  seen.add(key)
                  grouped.push({ empKey: key, emp: d.employee, deals: deals.filter(x => (x.employee?.id ?? x.employee?.name) === key) })
                }
              }
              return grouped.map(group => group.deals.map((d, idx) => {
              const v = values[d.id] || { kpi: '', kpi2: '', direct: '', purchase: '', external: '' }
              const kpiNum = parseFloat(v.kpi || '0')
              const kpi2Num = parseFloat(v.kpi2 || '0')
              const isProduct = d.calc_type === 'product'
              const kpi1 = isProduct && d.kpi_1_percent ? kpiNum / 100 : kpiNum
              const earned = isProduct ? kpi1 * kpi2Num * d.ratio : kpiNum * d.ratio
              const isExSelected = exDealId === d.id
              const isFirst = idx === 0
              const rowSpan = group.deals.length
              return (
                <tr key={d.id} className={`${isExSelected ? 'bg-orange-50' : 'hover:bg-gray-50'} ${isFirst && group.deals.length > 1 ? 'border-t-2 border-gray-200' : 'border-t border-gray-100'}`}>
                  {isFirst && (
                    <>
                      <td rowSpan={rowSpan} className="px-4 py-2 align-middle border-r border-gray-100">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          d.employee?.affiliation?.code === 'TC' ? 'bg-blue-100 text-blue-700' :
                          d.employee?.affiliation?.code === 'SAVI' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>{d.employee?.affiliation?.code}</span>
                      </td>
                      <td rowSpan={rowSpan} className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap align-middle border-r border-gray-100">{d.employee?.name}</td>
                    </>
                  )}
                  <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate text-xs">{d.title}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {d.calc_logic}
                    {isProduct ? ` (${(d.ratio * 100).toFixed(0)}만원)` : ` (${(d.ratio * 100).toFixed(0)}%)`}
                  </td>
                  <td className="px-4 py-2">
                    {isProduct ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          value={v.kpi}
                          onChange={e => handleChange(d.id, 'kpi', e.target.value)}
                          className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder={d.kpi_label_1 ?? 'KPI1'}
                          title={d.kpi_label_1 ?? 'KPI1'}
                        />
                        <input
                          type="number"
                          value={v.kpi2}
                          onChange={e => handleChange(d.id, 'kpi2', e.target.value)}
                          className="w-24 text-right border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder={d.kpi_label_2 ?? 'KPI2'}
                          title={d.kpi_label_2 ?? 'KPI2'}
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={v.kpi}
                        onChange={e => handleChange(d.id, 'kpi', e.target.value)}
                        className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="0"
                      />
                    )}
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
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={v.external}
                        onChange={e => handleChange(d.id, 'external', e.target.value)}
                        className={`w-20 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 ${
                          isExSelected ? 'border-orange-400 bg-orange-50 focus:ring-orange-400' : 'border-orange-200 focus:ring-orange-400'
                        }`}
                        placeholder="0"
                      />
                      <button
                        onClick={() => { setExDealId(isExSelected ? '' : d.id); setExSaved(false) }}
                        title="외부매입 상세 입력"
                        className={`text-xs px-1.5 py-1 rounded border transition-colors ${
                          isExSelected ? 'bg-orange-500 text-white border-orange-500' : 'border-orange-300 text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-blue-600">
                    {v.kpi ? earned.toFixed(1) : '-'}
                  </td>
                </tr>
              )
            }))
            })()}
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

      {/* 외부매입 상세 입력 */}
      {exDealId && (() => {
        const exDeal = deals.find(d => d.id === exDealId)
        const exTotal = exItems.reduce((s, i) => s + parseFloat(i.amount || '0'), 0)
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-800">
                  📋 외부매입 상세 입력 — {exDeal?.employee?.name} · {selectedMonth}월
                </h3>
                <p className="text-xs text-orange-600 mt-0.5">항목 저장 시 위 테이블 외부매입 값에 자동 반영됩니다.</p>
              </div>
              <button onClick={() => setExDealId('')} className="text-orange-400 hover:text-orange-600 text-sm">닫기 ✕</button>
            </div>

            {exItems.length > 0 ? (
              <div className="space-y-1.5">
                {exItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 text-sm border border-orange-100">
                    <span className="flex-1 text-gray-700">{item.desc}</span>
                    <span className="font-medium text-orange-600 w-24 text-right">
                      {parseFloat(item.amount || '0').toLocaleString('ko-KR', { minimumFractionDigits: 1 })} 백만
                    </span>
                    <button onClick={() => handleRemoveItem(idx)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex justify-between px-3 pt-1 text-sm font-semibold text-orange-700 border-t border-orange-200">
                  <span>합계</span>
                  <span>{exTotal.toLocaleString('ko-KR', { minimumFractionDigits: 1 })} 백만원</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-orange-400 text-center py-2">입력된 항목이 없습니다</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                placeholder="거래처 / 항목명"
                className="flex-1 border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <input
                type="number"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                placeholder="금액 (백만)"
                className="w-28 text-right border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <button
                onClick={handleAddItem}
                className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors whitespace-nowrap"
              >+ 추가</button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExSave}
                disabled={exSaving}
                className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {exSaving ? '저장 중...' : '외부매입 상세 저장'}
              </button>
              {exSaved && <span className="text-emerald-600 text-sm">✓ 저장 완료 (테이블에 반영됨)</span>}
            </div>
          </div>
        )
      })()}

      {/* 매입비 정산 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <h3 className="font-semibold text-orange-800 mb-1">🔄 {selectedMonth}월 매입비 정산</h3>
        <p className="text-xs text-orange-600 mb-4">
          KPI 입력이 완료되면 실행하세요. 현재 입력된 값 기준으로 매입자(송재호, 임홍진 등)의
          매입비를 자동 계산합니다.
          <br />
          <span className="font-medium">임홍진·김재훈 → 번돈 전액 / 나머지 → 남는돈 기여</span>
        </p>
        <button
          onClick={async () => {
            if (!confirm(`${selectedMonth}월 매입비를 정산하시겠습니까?\n\n현재 입력된 KPI 기준으로 매입자의 purchase_cost가 재계산됩니다.`)) return
            setSettling(true)
            setSettleResult(null)
            const res = await fetch('/api/admin/kpi/settle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ month: selectedMonth, year: 2026 }),
            })
            const data = await res.json()
            setSettling(false)
            if (data.success) setSettleResult(data.results)
            else alert('정산 실패')
          }}
          disabled={settling}
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {settling ? '정산 중...' : `${selectedMonth}월 매입비 정산 실행`}
        </button>

        {settleResult && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-semibold text-orange-700">✅ 정산 완료 — 반영된 매입비</p>
            {settleResult.map(r => (
              <div key={r.buyer} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-700 w-16">{r.buyer}</span>
                <span className={`font-bold ${r.amount >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  {(Math.round(r.amount * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1 })} 백만원
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
