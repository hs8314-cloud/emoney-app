'use client'
import { useState } from 'react'

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
}: {
  employees: any[]
  activeDeals: any[]
  months: number[]
  isExporter: boolean
}) {
  const tabs = [
    { key: 'summary', label: '전체 합계' },
    { key: 'deals', label: '성과거래' },
    ...(isExporter ? [{ key: 'export', label: '데이터 내보내기' }] : []),
  ] as const

  type TabKey = 'summary' | 'deals' | 'export'
  const [tab, setTab] = useState<TabKey>('summary')

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
        <div className="space-y-3">
          {activeDeals.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">활성 거래가 없습니다</div>
          ) : activeDeals.map((deal: any) => {
            const partnerAff = deal.partner?.affiliation?.code ?? deal.partner?.affiliation?.[0]?.code
            const empAff = deal.employee?.affiliation?.code ?? deal.employee?.affiliation?.[0]?.code
            return (
              <div key={deal.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${AFF_COLOR[empAff] ?? 'bg-gray-100 text-gray-600'}`}>{empAff}</span>
                      <span className="text-sm font-semibold text-gray-800">{deal.employee?.name}</span>
                      {deal.partner && (
                        <>
                          <span className="text-xs text-gray-400">→ 매입</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${AFF_COLOR[partnerAff] ?? 'bg-gray-100 text-gray-600'}`}>{partnerAff}</span>
                          <span className="text-sm text-gray-600">{deal.partner?.name}</span>
                        </>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{deal.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {deal.calc_logic} · <span className="text-blue-600 font-medium">{(deal.ratio * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 ml-4">{new Date(deal.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 내보내기 탭 (고형석만) */}
      {tab === 'export' && isExporter && (
        <div className="bg-white rounded-xl border p-8">
          <h3 className="font-semibold text-gray-800 mb-2">데이터 내보내기</h3>
          <p className="text-sm text-gray-500 mb-6">현재 조회된 전체 직원의 성과 데이터를 CSV 파일로 다운로드합니다.</p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium mb-1">포함 데이터</p>
              <ul className="space-y-1 text-gray-500">
                <li>· 소속, 이름</li>
                <li>· 월별 번돈 / 쓴돈 / 남는돈 / 배수</li>
                <li>· 누적 번돈 / 쓴돈 / 남는돈 / 배수</li>
              </ul>
            </div>
            <button
              onClick={handleExport}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              📥 CSV 다운로드 (2026년)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
