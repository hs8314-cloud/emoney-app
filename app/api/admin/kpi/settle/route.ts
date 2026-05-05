import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { effectiveRatio } from '@/lib/deal-utils'

// 번돈 전액을 매입자에게 기여하는 예외 판매자
const FULL_EARNED_SELLERS = ['임홍진', '김재훈']

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { month, year } = await req.json()

  // 1. 전체 활성 거래 + 직원 이름 조회
  const [{ data: allDeals }, { data: allEmps }] = await Promise.all([
    supabase.from('performance_deals').select('id, ratio, ratio_changes, calc_type, kpi_1_percent, employee_id, partner_id').eq('is_active', true),
    supabase.from('employees').select('id, name'),
  ])

  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, e.name]))
  const dealIds = (allDeals || []).map((d: any) => d.id)
  if (!dealIds.length) return NextResponse.json({ success: true, results: [] })

  // 2. 해당 월 KPI 데이터 조회
  const { data: kpiData } = await supabase
    .from('monthly_kpi')
    .select('performance_deal_id, kpi_value, kpi_value_2, direct_cost, purchase_cost, external_purchase_cost')
    .in('performance_deal_id', dealIds)
    .eq('year', year)
    .eq('month', month)

  const kpiMap = Object.fromEntries((kpiData || []).map((k: any) => [k.performance_deal_id, k]))

  // 3. 매입자별 기여액 합산
  const buyerContributions: Record<string, number> = {}
  for (const deal of (allDeals || [])) {
    if (!deal.partner_id) continue
    const kpi = kpiMap[deal.id]
    if (!kpi) continue  // 해당 월 KPI 미입력 판매자는 건너뜀

    const sellerName = empMap[deal.employee_id]
    const ratio = effectiveRatio(deal, month)
    const kpi1 = deal.calc_type === 'product' && deal.kpi_1_percent ? kpi.kpi_value / 100 : kpi.kpi_value
    const earned = deal.calc_type === 'product'
      ? kpi1 * (kpi.kpi_value_2 ?? 0) * ratio
      : kpi.kpi_value * ratio
    const spent = kpi.direct_cost + kpi.purchase_cost + (kpi.external_purchase_cost ?? 0)
    const remaining = earned - spent

    // 예외 판매자는 번돈 전액, 나머지는 남는돈
    const contribution = FULL_EARNED_SELLERS.includes(sellerName) ? earned : remaining
    buyerContributions[deal.partner_id] = (buyerContributions[deal.partner_id] ?? 0) + contribution
  }

  // 4. 매입자별 purchase_cost 업데이트
  const results: { buyer: string; amount: number }[] = []

  for (const [buyerId, amount] of Object.entries(buyerContributions)) {
    const { data: buyerDeal } = await supabase
      .from('performance_deals')
      .select('id')
      .eq('employee_id', buyerId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!buyerDeal) continue

    const { data: buyerRow } = await supabase
      .from('monthly_kpi')
      .select('id')
      .eq('performance_deal_id', buyerDeal.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (buyerRow) {
      await supabase.from('monthly_kpi').update({ purchase_cost: amount }).eq('id', buyerRow.id)
    } else {
      await supabase.from('monthly_kpi').insert({
        performance_deal_id: buyerDeal.id,
        year, month,
        kpi_value: 0, direct_cost: 0,
        purchase_cost: amount,
        external_purchase_cost: 0,
      })
    }
    results.push({ buyer: empMap[buyerId], amount })
  }

  return NextResponse.json({ success: true, results })
}
