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

  // FULL_EARNED: 번돈 전액을 매입자에게 기여
  const FULL_EARNED = new Set(['임홍진', '김재훈'])

  // 각 테이블 개별 조회 후 JS에서 합산
  const [{ data: allDeals }, { data: allDealsAll }, { data: allEmps }, { data: affiliations }, { data: kpiAll }] = await Promise.all([
    supabase.from('performance_deals').select('id, title, calc_logic, ratio, calc_type, kpi_1_percent, employee_id').eq('is_active', true),
    supabase.from('performance_deals').select('id, ratio, calc_type, kpi_1_percent, employee_id, partner_id, start_month, end_month'),
    supabase.from('employees').select('id, name, salary, affiliation_id, email, employee_no, grade, position_title'),
    supabase.from('affiliations').select('id, code'),
    supabase.from('monthly_kpi').select('*').eq('year', 2026).in('month', MONTHS),
  ])

  const affMap = Object.fromEntries((affiliations || []).map((a: any) => [a.id, a.code]))
  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, { ...e, affCode: affMap[e.affiliation_id] }]))
  const dealMap = Object.fromEntries((allDeals || []).map((d: any) => [d.id, d]))
  const activeDealIds = new Set((allDeals || []).map((d: any) => d.id))

  // KPI를 deal+month로 인덱싱
  const kpiByDealMonth: Record<string, Record<number, any>> = {}
  for (const row of (kpiAll || [])) {
    if (!kpiByDealMonth[row.performance_deal_id]) kpiByDealMonth[row.performance_deal_id] = {}
    kpiByDealMonth[row.performance_deal_id][row.month] = row
  }

  // 동적 purchase_cost 계산: buyer empId -> month -> amount
  // (저장된 값 대신 현재 seller 구조에서 실시간 계산 → 항상 breakdown 합계와 일치)
  const dynamicPurchase: Record<string, Record<number, number>> = {}
  for (const deal of (allDealsAll || [])) {
    if (!deal.partner_id) continue
    const sm = deal.start_month ?? 1
    const em = deal.end_month ?? 12
    const sellerName = empMap[deal.employee_id]?.name ?? ''
    const isFullEarned = FULL_EARNED.has(sellerName)
    for (const m of MONTHS) {
      if (m < sm || m > em) continue
      const kpi = kpiByDealMonth[deal.id]?.[m]
      if (!kpi) continue
      const kpi1 = deal.calc_type === 'product' && deal.kpi_1_percent ? kpi.kpi_value / 100 : kpi.kpi_value
      const earned = deal.calc_type === 'product'
        ? kpi1 * (kpi.kpi_value_2 ?? 0) * deal.ratio
        : kpi.kpi_value * deal.ratio
      const storedSpent = kpi.direct_cost + kpi.purchase_cost + (kpi.external_purchase_cost ?? 0)
      const contribution = isFullEarned ? earned : earned - storedSpent
      if (!dynamicPurchase[deal.partner_id]) dynamicPurchase[deal.partner_id] = {}
      dynamicPurchase[deal.partner_id][m] = (dynamicPurchase[deal.partner_id][m] ?? 0) + contribution
    }
  }

  // 직원별로 그룹핑 (복수 거래 합산, 동적 purchase_cost 사용)
  const employeeMap: Record<string, any> = {}
  for (const row of (kpiAll || [])) {
    if (!activeDealIds.has(row.performance_deal_id)) continue
    const deal = dealMap[row.performance_deal_id]
    const emp = empMap[deal?.employee_id]
    if (!emp || !deal) continue
    if (!employeeMap[emp.id]) {
      employeeMap[emp.id] = { name: emp.name, affiliation: emp.affCode, salary: emp.salary, months: {} }
    }
    const kpi1emp = deal.calc_type === 'product' && deal.kpi_1_percent ? row.kpi_value / 100 : row.kpi_value
    const earned = deal.calc_type === 'product'
      ? kpi1emp * (row.kpi_value_2 ?? 0) * deal.ratio
      : row.kpi_value * deal.ratio
    const purchase = dynamicPurchase[emp.id]?.[row.month] ?? 0
    const spent = row.direct_cost + purchase + (row.external_purchase_cost ?? 0)
    const remaining = earned - spent
    const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
    // 복수 거래 합산
    if (employeeMap[emp.id].months[row.month]) {
      const prev = employeeMap[emp.id].months[row.month]
      employeeMap[emp.id].months[row.month] = {
        earned: prev.earned + earned,
        spent: purchase + row.direct_cost + (row.external_purchase_cost ?? 0),
        remaining: prev.remaining + earned - (row.direct_cost + (row.external_purchase_cost ?? 0)),
        multiplier: 0, // 아래서 재계산
      }
    } else {
      employeeMap[emp.id].months[row.month] = { earned, spent, remaining, multiplier }
    }
  }
  // multiplier 재계산 (복수 거래 합산 후)
  for (const emp of Object.values(employeeMap) as any[]) {
    for (const m of MONTHS) {
      if (!emp.months[m]) continue
      const { earned, spent } = emp.months[m]
      emp.months[m].remaining = earned - spent
      emp.months[m].multiplier = emp.salary * 2 > 0 ? (earned - spent) / (emp.salary * 2) : 0
    }
  }

  const employees = Object.values(employeeMap)

  // 직원 정보 편집용: 전체 직원 목록 (소속별 정렬)
  const AFF_ORDER: Record<string, number> = { TC: 0, EV: 1, SAVI: 2 }
  const allEmployeesList = (allEmps || [])
    .map((e: any) => ({
      id: e.id,
      name: e.name,
      affCode: affMap[e.affiliation_id] ?? '',
      email: e.email ?? '',
      employee_no: e.employee_no ?? '',
      grade: e.grade ?? '',
      position_title: e.position_title ?? '',
    }))
    .sort((a: any, b: any) => {
      const ao = AFF_ORDER[a.affCode] ?? 9
      const bo = AFF_ORDER[b.affCode] ?? 9
      return ao !== bo ? ao - bo : a.name.localeCompare(b.name, 'ko')
    })

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
          allEmployees={allEmployeesList}
        />
      </main>
    </div>
  )
}
