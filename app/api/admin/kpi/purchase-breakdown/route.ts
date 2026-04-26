import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const FULL_EARNED_SELLERS = ['임홍진', '김재훈']

export async function GET(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('dealId')
  const year = parseInt(searchParams.get('year') || '2026')
  const month = parseInt(searchParams.get('month') || '0')

  if (!dealId || !month) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // 1. 해당 거래 정보
  const { data: deal } = await supabase
    .from('performance_deals')
    .select('employee_id, partner_id, ratio')
    .eq('id', dealId)
    .single()

  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: allEmps } = await supabase.from('employees').select('id, name')
  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, e.name]))

  // purchase_cost는 항상 "이 사람에게 기여한 하위 판매자들의 합산"
  // partner_id 유무와 무관하게 동일 로직: 이 employee를 partner로 하는 deals 찾기
  const { data: sellerDeals } = await supabase
    .from('performance_deals')
    .select('id, ratio, employee_id')
    .eq('partner_id', deal.employee_id)
    .eq('is_active', true)

  if (!sellerDeals?.length) {
    return NextResponse.json({ type: 'buyer', sellers: [], total: 0 })
  }

  const sellerDealIds = sellerDeals.map((d: any) => d.id)
  const { data: kpiRows } = await supabase
    .from('monthly_kpi')
    .select('performance_deal_id, kpi_value, direct_cost, purchase_cost, external_purchase_cost')
    .in('performance_deal_id', sellerDealIds)
    .eq('year', year)
    .eq('month', month)

  const kpiMap = Object.fromEntries((kpiRows || []).map((k: any) => [k.performance_deal_id, k]))

  const sellers = sellerDeals
    .map((d: any) => {
      const kpi = kpiMap[d.id]
      if (!kpi) return null
      const sellerName = empMap[d.employee_id] ?? '?'
      const earned = kpi.kpi_value * d.ratio
      const spent = kpi.direct_cost + kpi.purchase_cost + (kpi.external_purchase_cost ?? 0)
      const remaining = earned - spent
      const isFullEarned = FULL_EARNED_SELLERS.includes(sellerName)
      const contribution = isFullEarned ? earned : remaining
      return { name: sellerName, earned, remaining, isFullEarned, contribution }
    })
    .filter(Boolean)

  const total = sellers.reduce((s: number, r: any) => s + r.contribution, 0)

  return NextResponse.json({ type: 'buyer', sellers, total })
}
