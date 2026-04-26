import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// 이 판매자들은 번돈 전액이 매입자에게 기여됨 (나머지는 남는돈)
const FULL_EARNED_SELLERS = ['임홍진', '김재훈']

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { month, year, rows } = await req.json()
  // rows: ParsedRow[] from client (dealId, name, kpiValue, directCost, earned, remaining, partnerId, isFullEarned)

  // Step 1: 각 매도자의 kpi_value, direct_cost 저장 (purchase_cost는 건드리지 않음)
  for (const r of rows) {
    if (!r.dealId) continue

    const { data: existing } = await supabase
      .from('monthly_kpi')
      .select('id')
      .eq('performance_deal_id', r.dealId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (existing) {
      await supabase.from('monthly_kpi')
        .update({ kpi_value: r.kpiValue, direct_cost: r.directCost })
        .eq('id', existing.id)
    } else {
      await supabase.from('monthly_kpi').insert({
        performance_deal_id: r.dealId,
        year, month,
        kpi_value: r.kpiValue,
        direct_cost: r.directCost,
        purchase_cost: 0,
        external_purchase_cost: 0,
      })
    }
  }

  // Step 2: 매입자별 기여 합산
  const buyerContributions: Record<string, number> = {}
  for (const r of rows) {
    if (!r.partnerId) continue
    const contribution = FULL_EARNED_SELLERS.includes(r.name) ? r.earned : r.remaining
    buyerContributions[r.partnerId] = (buyerContributions[r.partnerId] ?? 0) + contribution
  }

  // Step 3: 매입자의 purchase_cost 업데이트
  for (const [buyerId, amount] of Object.entries(buyerContributions)) {
    // 매입자의 활성 성과거래 찾기
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
      // 기존 행: purchase_cost만 업데이트 (kpi_value 등 유지)
      await supabase.from('monthly_kpi')
        .update({ purchase_cost: amount })
        .eq('id', buyerRow.id)
    } else {
      // 신규 행 생성
      await supabase.from('monthly_kpi').insert({
        performance_deal_id: buyerDeal.id,
        year, month,
        kpi_value: 0,
        direct_cost: 0,
        purchase_cost: amount,
        external_purchase_cost: 0,
      })
    }
  }

  return NextResponse.json({ success: true, saved: rows.length, buyers: Object.keys(buyerContributions).length })
}
