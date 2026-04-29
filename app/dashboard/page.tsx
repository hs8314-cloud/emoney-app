import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
import NoticeBanner from '@/components/NoticeBanner'
import ActiveDealCard from '@/components/ActiveDealCard'
import Link from 'next/link'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 직원 정보 조회
  const { data: employee } = await supabase
    .from('employees')
    .select('*, affiliation:affiliations(*)')
    .eq('email', user.email)
    .single()

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">등록된 직원 정보가 없습니다. 관리자에게 문의하세요.</p>
      </div>
    )
  }

  // (관리자도 개인 대시보드 접근 허용 - 헤더에 관리자 링크 제공)

  // 내 성과거래 ID 목록 먼저 조회 (중단된 거래도 포함 - 누적 데이터 표시 위해)
  const { data: myDeals } = await supabase
    .from('performance_deals')
    .select('id, title, calc_logic, ratio, is_active, direct_note, calc_type')
    .eq('employee_id', employee.id)

  const myDealIds = (myDeals || []).map((d: any) => d.id)

  // 월별 KPI 조회 (deal_id 기준으로 안전하게 필터)
  const { data: kpiRows } = myDealIds.length > 0
    ? await supabase
        .from('monthly_kpi')
        .select('*')
        .in('performance_deal_id', myDealIds)
        .eq('year', 2026)
        .order('month')
    : { data: [] }

  // deal 정보 매핑
  const dealMap = Object.fromEntries((myDeals || []).map((d: any) => [d.id, d]))

  const rows = (kpiRows || []).map((r: any) => ({
    ...r,
    performance_deal: { ...dealMap[r.performance_deal_id], employee_id: employee.id },
  }))

  // 월별 계산 (쓴돈 구성요소 포함)
  const monthly = rows.map((r: any) => {
    const deal = r.performance_deal
    const earned = deal.calc_type === 'product'
      ? r.kpi_value * (r.kpi_value_2 ?? 0) * deal.ratio
      : r.kpi_value * deal.ratio
    const direct = r.direct_cost
    const purchase = r.purchase_cost
    const external = r.external_purchase_cost ?? 0
    const spent = direct + purchase + external
    const remaining = earned - spent
    const multiplier = employee.salary * 2 > 0 ? remaining / (employee.salary * 2) : 0
    return { month: r.month, earned, spent, remaining, multiplier, salary: employee.salary,
      kpi: r.kpi_value, ratio: deal.ratio, direct, purchase, external,
      direct_note: deal.direct_note ?? null }
  })

  // 누적 계산
  const cumEarned = monthly.reduce((s, m) => s + m.earned, 0)
  const cumSpent = monthly.reduce((s, m) => s + m.spent, 0)
  const cumRemaining = cumEarned - cumSpent
  const cumDirect = monthly.reduce((s, m) => s + m.direct, 0)
  const cumPurchase = monthly.reduce((s, m) => s + m.purchase, 0)
  const cumExternal = monthly.reduce((s, m) => s + m.external, 0)
  const monthCount = monthly.length
  const cumMultiplier = employee.salary * 2 * monthCount > 0 ? cumRemaining / (employee.salary * 2 * monthCount) : 0

  // 당월: 실제 현재 월 기준 (데이터 없으면 가장 최근 월)
  const actualMonth = new Date().getMonth() + 1
  const currentMonth = monthly.find(m => m.month === actualMonth) ?? monthly[monthly.length - 1]
  const currentMonthLabel = currentMonth?.month === actualMonth ? `${actualMonth}월` : `최근 (${currentMonth?.month}월)`

  // 성과거래 전체 (파트너 정보 포함, ActiveDealCard용)
  const { data: myDealsWithPartner } = await supabase
    .from('performance_deals')
    .select('*, partner:employees!performance_deals_partner_id_fkey(id, name, email, affiliation:affiliations(code))')
    .eq('employee_id', employee.id)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            employee.affiliation?.code === 'TC' ? 'bg-blue-100 text-blue-700' :
            employee.affiliation?.code === 'SAVI' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>{employee.affiliation?.code}</span>
          <span className="ml-2 font-bold text-gray-900">{employee.name}</span>
          <span className="ml-2 text-gray-400 text-sm">님의 E머니</span>
        </div>
        <div className="flex items-center gap-4">
          {employee.role === 'admin' && (
            <Link href="/admin" className="text-sm bg-gray-800 text-white px-3 py-1 rounded-lg hover:bg-gray-700">관리자 홈</Link>
          )}
          <Link href="/proposals" className="text-sm text-gray-500 hover:text-gray-700">성과거래</Link>
          <Link href="/kpi" className="text-sm text-blue-600 hover:text-blue-800 font-medium">KPI 입력</Link>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">설정</Link>
          <LogoutButton />
        </div>
      </header>
      <NoticeBanner />

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* 성과거래 카드 — ActiveDealCard (내용조회 포함) */}
        {(myDealsWithPartner && myDealsWithPartner.length > 0) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">나의 성과거래</p>
            {myDealsWithPartner.map((d: any) => (
              <ActiveDealCard key={d.id} deal={d} salary={employee.salary} />
            ))}
          </div>
        )}

        {/* 당월 / 누적 요약 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-xs text-gray-400 mb-3">당월 ({currentMonthLabel})</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-500">번돈</span>
                  {currentMonth && <p className="text-xs text-gray-300 mt-0.5">KPI {fmt(currentMonth.kpi)} × {(currentMonth.ratio * 100).toFixed(0)}%</p>}
                </div>
                <span className="font-medium text-blue-600">{fmt(currentMonth?.earned ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-500">쓴돈</span>
                  {currentMonth && currentMonth.spent > 0 && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {[
                        currentMonth.direct > 0 ? `직접비${currentMonth.direct_note ? `(${currentMonth.direct_note})` : ''} ${fmt(currentMonth.direct)}` : null,
                        currentMonth.purchase > 0 ? `내부매입 ${fmt(currentMonth.purchase)}` : null,
                        currentMonth.external > 0 ? `외부매입 ${fmt(currentMonth.external)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="font-medium text-red-400">{fmt(currentMonth?.spent ?? 0)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">남는돈</span>
                <span className={`font-bold ${(currentMonth?.remaining ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(currentMonth?.remaining ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400" title="남는돈 ÷ 급여×2 · 숫자가 클수록 효율적">배수 ⓘ</span>
                <span className="font-medium text-gray-700">{fmt(currentMonth?.multiplier ?? 0)}x</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-xs text-gray-400 mb-3">누적 (2026년 · {monthCount}개월)</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">번돈</span>
                <span className="font-medium text-blue-600">{fmt(cumEarned)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-500">쓴돈</span>
                  {cumSpent > 0 && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {[
                        cumDirect > 0 ? `직접비 ${fmt(cumDirect)}` : null,
                        cumPurchase > 0 ? `내부매입 ${fmt(cumPurchase)}` : null,
                        cumExternal > 0 ? `외부매입 ${fmt(cumExternal)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="font-medium text-red-400">{fmt(cumSpent)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">남는돈</span>
                <span className={`font-bold ${cumRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(cumRemaining)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400" title="남는돈 ÷ 급여×2×개월수 · 숫자가 클수록 효율적">배수 ⓘ</span>
                <span className="font-medium text-gray-700">{fmt(cumMultiplier)}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* 월별 상세 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">월별 상세 내역</h2>
            <p className="text-xs text-gray-400 mt-0.5">단위: 백만원</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">월</th>
                <th className="px-4 py-3 text-right">번돈</th>
                <th className="px-4 py-3 text-right text-gray-400">직접비</th>
                <th className="px-4 py-3 text-right text-gray-400">내부매입</th>
                <th className="px-4 py-3 text-right text-red-400">쓴돈</th>
                <th className="px-4 py-3 text-right font-semibold">남는돈</th>
                <th className="px-4 py-3 text-right" title="남는돈 ÷ 급여×2">배수 ⓘ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthly.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">{m.month}월</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-600 font-medium">{fmt(m.earned)}</span>
                    <p className="text-xs text-gray-300">KPI {fmt(m.kpi)} × {(m.ratio * 100).toFixed(0)}%</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {m.direct > 0 ? (
                      <>
                        <span>{fmt(m.direct)}</span>
                        {m.direct_note && <p className="text-xs text-gray-300">{m.direct_note}</p>}
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{m.purchase > 0 ? fmt(m.purchase) : '-'}</td>
                  <td className="px-4 py-3 text-right text-red-400">{fmt(m.spent)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${m.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(m.remaining)}
                  </td>
                  <td className={`px-4 py-3 text-right ${m.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {fmt(m.multiplier)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
