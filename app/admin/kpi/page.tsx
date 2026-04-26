import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import KpiForm from './KpiForm'

export default async function KpiInputPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single()

  if (me?.role !== 'admin') redirect('/dashboard')

  // 중첩 join 버그 우회: 각 테이블 개별 조회 후 JS에서 합산
  const [{ data: allDeals }, { data: allEmps }, { data: affiliations }, { data: existingKpi }] = await Promise.all([
    supabase.from('performance_deals').select('id, title, calc_logic, ratio, employee_id').eq('is_active', true).order('created_at'),
    supabase.from('employees').select('id, name, salary, affiliation_id'),
    supabase.from('affiliations').select('id, code'),
    supabase.from('monthly_kpi').select('*').eq('year', 2026),
  ])

  const affMap = Object.fromEntries((affiliations || []).map((a: any) => [a.id, a.code]))
  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, { ...e, affCode: affMap[e.affiliation_id] }]))

  const deals = (allDeals || []).map((d: any) => {
    const emp = empMap[d.employee_id]
    return {
      ...d,
      employee: emp ? {
        id: emp.id,
        name: emp.name,
        salary: emp.salary,
        affiliation: { code: emp.affCode },
      } : null,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← 관리자 홈</Link>
          <h1 className="font-bold text-gray-900">KPI 데이터 입력</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800 flex flex-wrap gap-x-4 gap-y-0.5 items-center">
          <span className="font-semibold text-blue-900 mr-1">📋 입력 안내</span>
          <span><strong>KPI 값</strong>: 월 성과지표 (백만원)</span>
          <span><strong>직접비</strong>: 직접 발생 비용</span>
          <span><strong>내부매입</strong>: 내부 성과 매입액</span>
          <span><strong>외부매입</strong>: 외부 별도 매입</span>
          <span className="text-blue-700">번돈 = KPI×비율 · 쓴돈 = 직접비+내부+외부 · 남는돈 = 번돈−쓴돈</span>
        </div>
        <KpiForm deals={deals} existingKpi={existingKpi || []} />
      </main>
    </div>
  )
}
