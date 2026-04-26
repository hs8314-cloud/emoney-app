import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { dealId, year, month, kpiValue, directCost } = await req.json()

  // 본인 거래인지 검증
  const { data: deal } = await supabase
    .from('performance_deals')
    .select('id')
    .eq('id', dealId)
    .eq('employee_id', employee.id)
    .eq('is_active', true)
    .single()

  if (!deal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('monthly_kpi')
    .select('id')
    .eq('performance_deal_id', dealId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    await supabase.from('monthly_kpi')
      .update({ kpi_value: kpiValue, direct_cost: directCost })
      .eq('id', existing.id)
  } else {
    await supabase.from('monthly_kpi').insert({
      performance_deal_id: dealId,
      year, month,
      kpi_value: kpiValue,
      direct_cost: directCost,
      purchase_cost: 0,
      external_purchase_cost: 0,
    })
  }

  return NextResponse.json({ success: true })
}
