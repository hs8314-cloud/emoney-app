import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'
import AdminTabs from './AdminTabs'

const MONTHS = [1, 2, 3]

export default async function AdminPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('id, name, role, email')
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
        months: {},
      }
    }
    const earned = row.kpi_value * deal.ratio
    const spent = row.direct_cost + row.purchase_cost
    const remaining = earned - spent
    const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
    employeeMap[emp.id].months[row.month] = { earned, spent, remaining, multiplier }
  }

  const employees = Object.values(employeeMap)

  // 전체 활성 거래 조회 (partner 포함)
  const { data: activeDeals } = await supabase
    .from('performance_deals')
    .select(`
      *,
      employee:employees!performance_deals_employee_id_fkey(name, affiliation:affiliations(code)),
      partner:employees!performance_deals_partner_id_fkey(name, affiliation:affiliations(code))
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // 고형석만 내보내기 권한
  const isExporter = me.name === '고형석'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-gray-900">E머니 관리자</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">{me.name}</span>
          <Link href="/admin/kpi"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            KPI 입력
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">내 대시보드</Link>
          <Link href="/proposals" className="text-sm text-gray-500 hover:text-gray-700">성과거래</Link>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">설정</Link>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-400">2026년 · 단위: 백만원</span>
        </div>
        <AdminTabs
          employees={employees}
          activeDeals={activeDeals || []}
          months={MONTHS}
          isExporter={isExporter}
        />
      </main>
    </div>
  )
}
