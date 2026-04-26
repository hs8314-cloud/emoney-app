'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Deal = {
  id: string
  title: string
  ratio: number
  employee: { id: string; name: string }
  partner: { id: string; name: string } | null
}

type ParsedRow = {
  dealId: string
  name: string
  dealTitle: string
  ratio: number
  partnerId: string | null
  partnerName: string | null
  kpiValue: number
  directCost: number
  earned: number
  remaining: number
  isFullEarned: boolean
}

type Step = 'upload' | 'map' | 'preview'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const FULL_EARNED_SELLERS = ['임홍진', '김재훈']
const YEAR = 2026

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parse = (line: string) => line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) }
}

export default function UploadForm({ deals }: { deals: Deal[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [headers, setHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [kpiCol, setKpiCol] = useState('')
  const [directCol, setDirectCol] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)
      setHeaders(headers)
      setCsvRows(rows)
      // 자동 컬럼 감지
      setNameCol(headers.find(h => ['성명', '이름', '직원명', '성명(한글)'].some(k => h.includes(k))) ?? '')
      setKpiCol(headers.find(h => ['영업이익', '매출액', 'KPI', '이익', '매출'].some(k => h.toUpperCase().includes(k.toUpperCase()))) ?? '')
      setDirectCol(headers.find(h => ['직접비', '비용', '원가'].some(k => h.includes(k))) ?? '')
      setStep('map')
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function buildPreview() {
    const ni = headers.indexOf(nameCol)
    const ki = headers.indexOf(kpiCol)
    const di = directCol ? headers.indexOf(directCol) : -1
    const matched: ParsedRow[] = []
    const notFound: string[] = []

    for (const row of csvRows) {
      const name = row[ni]?.trim()
      if (!name) continue
      const kpiValue = parseFloat(row[ki]?.replace(/,/g, '') || '0') || 0
      const directCost = di >= 0 ? parseFloat(row[di]?.replace(/,/g, '') || '0') || 0 : 0
      const deal = deals.find(d => d.employee.name === name)
      if (!deal) { notFound.push(name); continue }
      const earned = kpiValue * deal.ratio
      const remaining = earned - directCost
      matched.push({
        dealId: deal.id, name, dealTitle: deal.title, ratio: deal.ratio,
        partnerId: deal.partner?.id ?? null, partnerName: deal.partner?.name ?? null,
        kpiValue, directCost, earned, remaining,
        isFullEarned: FULL_EARNED_SELLERS.includes(name),
      })
    }
    setPreview(matched)
    setUnmatched(notFound)
    setStep('preview')
  }

  // 매입자별 기여 합산
  const buyerSummary: Record<string, { name: string; total: number; sources: string[] }> = {}
  for (const r of preview) {
    if (!r.partnerId || !r.partnerName) continue
    const contribution = r.isFullEarned ? r.earned : r.remaining
    if (!buyerSummary[r.partnerId]) buyerSummary[r.partnerId] = { name: r.partnerName, total: 0, sources: [] }
    buyerSummary[r.partnerId].total += contribution
    buyerSummary[r.partnerId].sources.push(`${r.name} ${fmt(contribution)}`)
  }

  async function handleConfirm() {
    setSaving(true)
    const res = await fetch('/api/admin/kpi/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year: YEAR, rows: preview }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => router.push('/admin/kpi'), 2000) }
    else alert('저장 실패')
  }

  const stepLabels: Record<Step, string> = { upload: '파일 업로드', map: '컬럼 매핑', preview: '검토 & 확정' }
  const stepOrder: Step[] = ['upload', 'map', 'preview']

  if (saved) return (
    <div className="text-center py-24">
      <p className="text-5xl mb-4">✅</p>
      <p className="text-xl font-bold text-gray-800">{month}월 데이터 저장 완료</p>
      <p className="text-gray-500 mt-2">매입비 자동 계산까지 완료됐습니다. KPI 입력 페이지로 이동 중...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 단계 표시 */}
      <div className="flex items-center gap-2 text-sm">
        {stepOrder.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-blue-600 text-white'
              : stepOrder.indexOf(step) > i ? 'bg-emerald-500 text-white'
              : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</div>
            <span className={step === s ? 'text-blue-600 font-medium' : 'text-gray-400'}>{stepLabels[s]}</span>
            {i < 2 && <span className="text-gray-300">›</span>}
          </div>
        ))}
      </div>

      {/* Step 1: 업로드 */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {MONTHS.map(m => (
              <button key={m} onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  month === m ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:border-blue-400'
                }`}>{m}월</button>
            ))}
          </div>
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById('csvFileInput')?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-20 text-center hover:border-blue-400 transition-colors cursor-pointer bg-white"
          >
            <p className="text-5xl mb-4">📂</p>
            <p className="text-gray-700 font-semibold text-lg">AMIS CSV 파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-gray-400 text-sm mt-2">CSV 형식 (.csv) · UTF-8 인코딩 권장</p>
            <input id="csvFileInput" type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* Step 2: 컬럼 매핑 */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">📄 {fileName} · {csvRows.length}행 감지됨</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '이름 컬럼 *', value: nameCol, set: setNameCol },
                { label: 'KPI 값 컬럼 *', value: kpiCol, set: setKpiCol },
                { label: '직접비 컬럼 (선택)', value: directCol, set: setDirectCol },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <select value={value} onChange={e => set(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">-- 선택 --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto mt-2">
              <p className="text-xs text-gray-400 mb-1">CSV 미리보기 (상위 3행)</p>
              <table className="text-xs border-collapse">
                <thead>
                  <tr>{headers.map(h => (
                    <th key={h} className={`border border-gray-200 px-2 py-1 bg-gray-50 ${
                      [nameCol, kpiCol, directCol].includes(h) ? 'text-blue-600 font-bold' : 'text-gray-500'
                    }`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 3).map((row, i) => (
                    <tr key={i}>{row.map((c, j) => (
                      <td key={j} className={`border border-gray-200 px-2 py-1 ${
                        [nameCol, kpiCol, directCol].includes(headers[j]) ? 'bg-blue-50 font-medium' : ''
                      }`}>{c}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('upload')}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              ← 다시 업로드
            </button>
            <button onClick={buildPreview} disabled={!nameCol || !kpiCol}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              결과 미리보기 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 검토 & 확정 */}
      {step === 'preview' && (
        <div className="space-y-5">
          {unmatched.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ 매칭 실패 ({unmatched.length}명): <strong>{unmatched.join(', ')}</strong>
              &nbsp;— 활성 성과거래가 없거나 이름이 다릅니다. 저장에서 제외됩니다.
            </div>
          )}

          {/* 매도자 KPI 테이블 */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">📊 {YEAR}년 {month}월 KPI 데이터 — {preview.length}명</h3>
              <span className="text-xs text-gray-400">단위: 백만원</span>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">이름</th>
                    <th className="px-4 py-2 text-right">KPI 값</th>
                    <th className="px-4 py-2 text-right">비율</th>
                    <th className="px-4 py-2 text-right">직접비</th>
                    <th className="px-4 py-2 text-right text-blue-600">번돈</th>
                    <th className="px-4 py-2 text-right text-emerald-600">남는돈</th>
                    <th className="px-4 py-2 text-right">매입자</th>
                    <th className="px-4 py-2 text-right text-orange-600">매입 기여액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map(r => {
                    const contribution = r.isFullEarned ? r.earned : r.remaining
                    return (
                      <tr key={r.dealId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {r.name}
                          {r.isFullEarned && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">번돈 전액</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{fmt(r.kpiValue)}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{(r.ratio * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2 text-right text-red-400">{fmt(r.directCost)}</td>
                        <td className="px-4 py-2 text-right text-blue-600 font-medium">{fmt(r.earned)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${r.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(r.remaining)}</td>
                        <td className="px-4 py-2 text-right text-gray-500 text-xs">{r.partnerName ?? '—'}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${contribution >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          {r.partnerName ? fmt(contribution) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 매입 자동 계산 요약 */}
          {Object.keys(buyerSummary).length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-3 border-b bg-orange-50">
                <h3 className="font-semibold text-orange-800">🔄 매입비 자동 계산 — 저장 시 즉시 반영</h3>
                <p className="text-xs text-orange-600 mt-0.5">임홍진·김재훈: 번돈 전액 기여 / 나머지: 남는돈 기여</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-2 text-left">매입자</th>
                    <th className="px-5 py-2 text-left">구성</th>
                    <th className="px-5 py-2 text-right text-orange-600">총 매입비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.values(buyerSummary).map(b => (
                    <tr key={b.name}>
                      <td className="px-5 py-3 font-semibold text-gray-800">{b.name}</td>
                      <td className="px-5 py-3 text-xs text-gray-400">{b.sources.join(' + ')}</td>
                      <td className={`px-5 py-3 text-right font-bold text-lg ${b.total >= 0 ? 'text-orange-600' : 'text-red-600'}`}>{fmt(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep('map')}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              ← 다시 매핑
            </button>
            <button onClick={handleConfirm} disabled={saving || preview.length === 0}
              className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : `✅ ${month}월 데이터 확정 저장`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
