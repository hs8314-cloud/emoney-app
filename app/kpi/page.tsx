import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import KpiSelfForm from './KpiSelfForm'

export default async function KpiSelfPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, salary, role')
    .eq('email', user.email)
    .single()

  if (!employee) redirect('/dashboard')

  // 본인의 활성 성과거래
  const { data: deals } = await supabase
    .from('performance_deals')
    .select('id, title, calc_logic, ratio, direct_note')
    .eq('employee_id', employee.id)
    .eq('is_active', true)
    .order('created_at')

  // 기존 KPI 데이터
  const dealIds = (deals || []).map((d: any) => d.id)
  const { data: existingKpi } = dealIds.length > 0
    ? await supabase
        .from('monthly_kpi')
        .select('performance_deal_id, month, kpi_value, direct_cost')
        .in('performance_deal_id', dealIds)
        .eq('year', 2026)
    : { data: [] }

  const backUrl = employee.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-gray-400 hover:text-gray-600 text-sm">← 돌아가기</Link>
          <h1 className="font-bold text-gray-900">내 KPI 입력</h1>
          <span className="text-sm text-gray-400">{employee.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800 flex flex-wrap gap-x-4 gap-y-0.5 items-center">
          <span className="font-semibold text-blue-900">📋 입력 안내</span>
          <span>해당 월의 KPI 실적값을 입력하세요 · 단위: 백만원</span>
          <span>번돈 = KPI × 비율 · 남는돈 = 번돈 − 직접비</span>
        </div>

        {(!deals || deals.length === 0) ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
            <p>활성화된 성과거래가 없습니다.</p>
          </div>
        ) : (
          <KpiSelfForm
            deals={deals}
            existingKpi={existingKpi || []}
            salary={employee.salary}
            employeeId={employee.id}
          />
        )}
      </main>
    </div>
  )
}
