'use client'
import { useState, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

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
  start_month?: number | null
  end_month?: number | null
  calc_type?: string | null
  kpi_label_1?: string | null
  kpi_label_2?: string | null
}

type ExistingKpi = {
  performance_deal_id: string
  month: number
  kpi_value: number
  kpi_value_2?: number
  direct_cost: number
}

export default function KpiSelfForm({
  deals,
  existingKpi,
  salary,
  employeeId,
}: {
  deals: Deal[]
  existingKpi: ExistingKpi[]
  salary: number
  employeeId: string
}) {
  const currentMonth = new Date().getMonth() + 1
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  // 해당 월에 하나라도 유효한 거래가 있으면 활성
  function isMonthValid(m: number) {
    return deals.some(d => m >= (d.start_month ?? 1) && m <= (d.end_month ?? 12))
  }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<Record<string, { kpi: string; kpi2: string; direct: string }>>(() => {
    const init: Record<string, { kpi: string; kpi2: string; direct: string }> = {}
    deals.forEach(d => {
      const ex = existingKpi.find(k => k.performance_deal_id === d.id && k.month === currentMonth)
      init[d.id] = { kpi: ex ? String(ex.kpi_value) : '', kpi2: ex ? String(ex.kpi_value_2 ?? 0) : '', direct: ex ? String(ex.direct_cost) : '' }
    })
    return init
  })

  function handleMonthChange(m: number) {
    setSelectedMonth(m)
    const next: Record<string, { kpi: string; kpi2: string; direct: string }> = {}
    deals.forEach(d => {
      const ex = existingKpi.find(k => k.performance_deal_id === d.id && k.month === m)
      next[d.id] = { kpi: ex ? String(ex.kpi_value) : '', kpi2: ex ? String(ex.kpi_value_2 ?? 0) : '', direct: ex ? String(ex.direct_cost) : '' }
    })
    setValues(next)
    setSaved(false)
    setFile(null)
    setUploadError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    if (!file) { setUploadError('근거자료 파일을 첨부해주세요.'); return }

    setSaving(true)
    setSaved(false)
    setUploadError('')

    // 1. 파일 Supabase Storage 업로드
    const supabase = createSupabaseBrowser()
    const ext = file.name.split('.').pop()
    const path = `${YEAR}/${selectedMonth}/${employeeId}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('kpi-attachments')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setUploadError('파일 업로드 실패: ' + uploadErr.message)
      setSaving(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('kpi-attachments').getPublicUrl(path)

    // 2. KPI 저장 + 이메일 발송
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
          kpiValue2: parseFloat(v.kpi2 || '0'),
          directCost: parseFloat(v.direct || '0'),
          attachmentUrl: publicUrl,
          sendEmail: true,
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
        {MONTHS.map(m => {
          const valid = isMonthValid(m)
          return (
            <button key={m} onClick={() => valid && handleMonthChange(m)}
              disabled={!valid}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !valid ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : selectedMonth === m ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:border-blue-400'
              }`}>
              {m}월
            </button>
          )
        })}
      </div>

      {/* 거래별 입력 카드 */}
      {deals.filter(deal => selectedMonth >= (deal.start_month ?? 1) && selectedMonth <= (deal.end_month ?? 12)).map(deal => {
        const v = values[deal.id] || { kpi: '', kpi2: '', direct: '' }
        const kpiNum = parseFloat(v.kpi || '0') || 0
        const kpi2Num = parseFloat(v.kpi2 || '0') || 0
        const directNum = parseFloat(v.direct || '0') || 0
        const isProduct = deal.calc_type === 'product'
        const earned = isProduct ? kpiNum * kpi2Num * deal.ratio : kpiNum * deal.ratio
        const spent = directNum
        const remaining = earned - spent
        const multiplier = salary * 2 > 0 ? remaining / (salary * 2) : 0
        const hasKpi = isProduct ? kpiNum > 0 && kpi2Num > 0 : kpiNum > 0

        return (
          <div key={deal.id} className="bg-white rounded-xl border p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-900">{deal.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {deal.calc_logic}
                {isProduct
                  ? <> · 단가 <span className="text-blue-600 font-medium">{(deal.ratio * 100).toFixed(0)}만원</span></>
                  : <> · 비율 <span className="text-blue-600 font-medium">{(deal.ratio * 100).toFixed(0)}%</span></>
                }
              </p>
            </div>

            <div className={`grid gap-3 ${isProduct ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isProduct ? (deal.kpi_label_1 ?? 'KPI1') : <>KPI 값 <span className="text-gray-400">(백만원)</span></>}
                </label>
                <input
                  type="number"
                  value={v.kpi}
                  onChange={e => { setValues(prev => ({ ...prev, [deal.id]: { ...prev[deal.id], kpi: e.target.value } })); setSaved(false) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={isProduct ? "예: 0.95" : "예: 494"}
                />
              </div>
              {isProduct && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {deal.kpi_label_2 ?? 'KPI2'}
                  </label>
                  <input
                    type="number"
                    value={v.kpi2}
                    onChange={e => { setValues(prev => ({ ...prev, [deal.id]: { ...prev[deal.id], kpi2: e.target.value } })); setSaved(false) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="예: 1000"
                  />
                </div>
              )}
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
            {hasKpi && (
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

      {/* 근거자료 첨부 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">📎 근거자료 첨부 <span className="text-red-500">*</span></p>
          <p className="text-xs text-gray-400 mt-0.5">KPI 실적을 증빙하는 파일을 첨부해주세요 (필수)</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <span className="inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              파일 선택
            </span>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.csv"
              onChange={e => { setFile(e.target.files?.[0] || null); setUploadError(''); setSaved(false) }}
            />
          </label>
          {file
            ? <span className="text-sm text-gray-700 truncate max-w-xs">{file.name}</span>
            : <span className="text-sm text-gray-400">선택된 파일 없음</span>
          }
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>

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
