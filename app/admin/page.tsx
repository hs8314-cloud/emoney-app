import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const MONTHS = [1, 2, 3]

export default async function AdminPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single()

  if (me?.role !== 'admin') redirect('/dashboard')

  // 전체 KPI 데이터 조회
  const { data: kpiRows } = await supabase
    .from('monthly_kpi')
    .select(`*, performance_deal:performance_deals(*, employee:employees(*, affiliation:affiliations(*)))`)
    .eq('year', 2026)
    .in('month', MONTHS)
    .order('month')

  // 직원별로 그룹핑
  const employeeMap: Record<string, any> = {}
  for (const row of kpiRows || []) {
    const deal = row.performance_deal
    const emp = deal?.employee
    if (!emp) continue
    if (!employeeMap[emp.id]) {
      employeeMap[emp.id] = {
        name: emp.name,
        affiliation: emp.affiliation?.code,
        salary: emp.salary,
        deal: deal,
        months: {}
      }
    }
    const earned = row.kpi_value * deal.ratio
    const spent = row.direct_cost + row.purchase_cost
    const remaining = earned - spent
    const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
    employeeMap[emp.id].months[row.month] = { earned, spent, remaining, multiplier }
  }

  const employees = Object.values(employeeMap)

  // 누적 합계 (배수 = 누적 남는돈 ÷ (급여 × 2 × 개월수))
  function cumCalc(months: Record<number, any>, salary: number) {
    const earned = MONTHS.reduce((s, m) => s + (months[m]?.earned ?? 0), 0)
    const spent = MONTHS.reduce((s, m) => s + (months[m]?.spent ?? 0), 0)
    const remaining = earned - spent
    const monthCount = MONTHS.filter(m => months[m] !== undefined).length
    const multiplier = salary * 2 * monthCount > 0 ? remaining / (salary * 2 * monthCount) : 0
    return { earned, spent, remaining, multiplier }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-gray-900">E머니 관리자</h1>
          <Link href="/admin/kpi"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            KPI 입력
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/proposals" className="text-sm text-gray-500 hover:text-gray-700">성과거래 제안</Link>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">설정</Link>
          <LogoutButton />
        </div>
      </header>

      <main className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">전체 직원 월별 성과</h2>
          <span className="text-xs text-gray-400">2026년 · 단위: 백만원</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">소속</th>
                <th className="px-4 py-3 text-left">이름</th>
                {MONTHS.map(m => (
                  <th key={m} colSpan={3} className="px-4 py-3 text-center border-l">{m}월</th>
                ))}
                <th colSpan={3} className="px-4 py-3 text-center border-l bg-blue-50">누적</th>
              </tr>
              <tr className="text-xs text-gray-400 border-t">
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                {MONTHS.map(m => (
                  <>
                    <th key={`${m}-e`} className="px-3 py-2 text-right border-l">번돈</th>
                    <th key={`${m}-s`} className="px-3 py-2 text-right">쓴돈</th>
                    <th key={`${m}-r`} className="px-3 py-2 text-right">남는돈</th>
                  </>
                ))}
                <th className="px-3 py-2 text-right border-l bg-blue-50">번돈</th>
                <th className="px-3 py-2 text-right bg-blue-50">쓴돈</th>
                <th className="px-3 py-2 text-right bg-blue-50 font-semibold">남는돈</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp: any, i: number) => {
                const cum = cumCalc(emp.months, emp.salary)
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        emp.affiliation === 'TC' ? 'bg-blue-100 text-blue-700' :
                        emp.affiliation === 'SAVI' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>{emp.affiliation}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                    {MONTHS.map(m => {
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
