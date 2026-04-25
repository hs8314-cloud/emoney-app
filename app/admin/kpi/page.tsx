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

  // 전체 직원 + 성과거래 조회
  const { data: deals } = await supabase
    .from('performance_deals')
    .select(`*, employee:employees(*, affiliation:affiliations(*))`)
    .eq('is_active', true)
    .order('created_at')

  // 기존 KPI 데이터 조회 (2026년)
  const { data: existingKpi } = await supabase
    .from('monthly_kpi')
    .select('*')
    .eq('year', 2026)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← 관리자 홈</Link>
          <h1 className="font-bold text-gray-900">KPI 데이터 입력</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-gray-500 mb-6">각 직원의 월별 KPI, 직접비, 매입비를 입력하세요. 단위: 백만원</p>
        <KpiForm deals={deals || []} existingKpi={existingKpi || []} />
      </main>
    </div>
  )
}
