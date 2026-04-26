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

  // 각 테이블 개별 조회 후 JS에서 합산 (중첩 join 버그 우회)
  const [{ data: allDeals }, { data: allEmps }, { data: affiliations }, { data: kpiAll }] = await Promise.all([
    supabase.from('performance_deals').select('id, title, calc_logic, ratio, employee_id').eq('is_active', true),
    supabase.from('employees').select('id, name, salary, affiliation_id'),
    supabase.from('affiliations').select('id, code'),
    supabase.from('monthly_kpi').select('*').eq('year', 2026).in('month', MONTHS),
  ])

  const affMap = Object.fromEntries((affiliations || []).map((a: any) => [a.id, a.code]))
  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, { ...e, affCode: affMap[e.affiliation_id] }]))
  const dealMap = Object.fromEntries((allDeals || []).map((d: any) => [d.id, d]))
  const activeDealIds = new Set((allDeals || []).map((d: any) => d.id))

  // 직원별로 그룹핑
  const employeeMap: Record<string, any> = {}
  for (const row of (kpiAll || [])) {
    if (!activeDealIds.has(row.performance_deal_id)) continue
    const deal = dealMap[row.performance_deal_id]
    const emp = empMap[deal?.employee_id]
    if (!emp || !deal) continue
    if (!employeeMap[emp.id]) {
      employeeMap[emp.id] = { name: emp.name, affiliation: emp.affCode, salary: emp.salary, months: {} }
    }
    const earned = row.kpi_value * deal.ratio
    const spent = row.direct_cost + row.purchase_cost + (row.external_purchase_cost ?? 0)
    const remaining = earned - spent
    const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
    employeeMap[emp.id].months[row.month] = { earned, spent, remaining, multiplier }
  }

  const employees = Object.values(employeeMap)

  // 전체 활성 거래 (JS에서 employee/partner 매핑)
  const { data: allActiveDeals } = await supabase
    .from('performance_deals')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const activeDeals = (allActiveDeals || []).map((d: any) => ({
    ...d,
    employee: empMap[d.employee_id] ? { name: empMap[d.employee_id].name, affiliation: { code: empMap[d.employee_id].affCode } } : null,
    partner: empMap[d.partner_id] ? { name: empMap[d.partner_id].name, affiliation: { code: empMap[d.partner_id].affCode } } : null,
  }))

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
