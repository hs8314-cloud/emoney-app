import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
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
    .select('id, title, calc_logic, ratio, is_active')
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

  // 월별 계산
  const monthly = rows.map((r: any) => {
    const deal = r.performance_deal
    const earned = r.kpi_value * deal.ratio
    const spent = r.direct_cost + r.purchase_cost + (r.external_purchase_cost ?? 0)
    const remaining = earned - spent
    const multiplier = employee.salary * 2 > 0 ? remaining / (employee.salary * 2) : 0
    return { month: r.month, earned, spent, remaining, multiplier, salary: employee.salary }
  })

  // 누적 계산 (배수 = 누적 남는돈 ÷ (급여 × 2 × 개월수))
  const cumEarned = monthly.reduce((s, m) => s + m.earned, 0)
  const cumSpent = monthly.reduce((s, m) => s + m.spent, 0)
  const cumRemaining = cumEarned - cumSpent
  const monthCount = monthly.length
  const cumMultiplier = employee.salary * 2 * monthCount > 0 ? cumRemaining / (employee.salary * 2 * monthCount) : 0

  const currentMonth = monthly[monthly.length - 1]

  // 성과거래 정보 (활성 우선, 없으면 중단된 거래 표시)
  const { data: deal } = await supabase
    .from('performance_deals')
    .select('*')
    .eq('employee_id', employee.id)
    .order('is_active', { ascending: false })
    .limit(1)
    .single()

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

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* 성과거래 카드 */}
        {deal && (
          <div className={`bg-white rounded-xl p-5 shadow-sm border ${!deal.is_active ? 'opacity-70' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-gray-400">나의 성과거래</p>
              {!deal.is_active && (
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded font-medium">거래중단</span>
              )}
            </div>
            <p className="font-semibold text-gray-800">{deal.title}</p>
            <p className="text-sm text-gray-500 mt-1">
              산출 로직: <span className="text-blue-600">{deal.calc_logic}</span>
              &nbsp;·&nbsp;비율: <span className="text-blue-600">{(deal.ratio * 100).toFixed(0)}%</span>
            </p>
          </div>
        )}

        {/* 당월 / 누적 요약 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-xs text-gray-400 mb-3">당월 ({currentMonth?.month}월)</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">번돈</span>
                <span className="font-medium text-blue-600">{fmt(currentMonth?.earned ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">쓴돈</span>
                <span className="font-medium text-red-400">{fmt(currentMonth?.spent ?? 0)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">남는돈</span>
                <span className={`font-bold ${(currentMonth?.remaining ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(currentMonth?.remaining ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">배수</span>
                <span className="font-medium text-gray-700">{fmt(currentMonth?.multiplier ?? 0)}x</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <p className="text-xs text-gray-400 mb-3">누적 (2026년)</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">번돈</span>
                <span className="font-medium text-blue-600">{fmt(cumEarned)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">쓴돈</span>
                <span className="font-medium text-red-400">{fmt(cumSpent)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">남는돈</span>
                <span className={`font-bold ${cumRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(cumRemaining)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">배수</span>
                <span className="font-medium text-gray-700">{fmt(cumMultiplier)}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* 월별 상세 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">월별 상세 내역</h2>
            <p className="text-xs text-gray-400 mt-0.5">단위: 백만원</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left">월</th>
                <th className="px-5 py-3 text-right">번돈</th>
                <th className="px-5 py-3 text-right">쓴돈</th>
                <th className="px-5 py-3 text-right">급여</th>
                <th className="px-5 py-3 text-right font-semibold">남는돈</th>
                <th className="px-5 py-3 text-right">배수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthly.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-700">{m.month}월</td>
                  <td className="px-5 py-3 text-right text-blue-600">{fmt(m.earned)}</td>
                  <td className="px-5 py-3 text-right text-red-400">{fmt(m.spent)}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{fmt(m.salary)}</td>
                  <td className={`px-5 py-3 text-right font-bold ${m.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(m.remaining)}
                  </td>
                  <td className={`px-5 py-3 text-right ${m.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
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
