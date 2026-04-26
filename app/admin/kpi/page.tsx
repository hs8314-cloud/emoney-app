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
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">📋 KPI 입력 안내</p>
          <p>· <strong>KPI 값</strong>: 해당 월의 성과 지표 (영업이익, 매출액 등) — 단위: 백만원</p>
          <p>· <strong>직접비</strong>: 해당 거래에서 직접 발생한 비용 (인건비, 운영비 등)</p>
          <p>· <strong>내부매입</strong>: 다른 직원의 성과를 매입한 금액 (자동 산출 기준값)</p>
          <p>· <strong>외부매입</strong>: 내부 거래 외 별도 외부 매입 발생 시 입력</p>
          <p>· <strong>번돈</strong> = KPI 값 × 비율 &nbsp;|&nbsp; <strong>쓴돈</strong> = 직접비 + 내부매입 + 외부매입 &nbsp;|&nbsp; <strong>남는돈</strong> = 번돈 − 쓴돈</p>
        </div>
        <KpiForm deals={deals} existingKpi={existingKpi || []} />
      </main>
    </div>
  )
}
