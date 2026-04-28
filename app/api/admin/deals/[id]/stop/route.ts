import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('role').eq('email', user.email).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const endMonth: number | undefined = body.endMonth

  // end_month만 설정 — is_active는 건드리지 않음 (거래 카드는 계속 표시)
  const updateData: Record<string, any> = {}
  if (endMonth && endMonth >= 1 && endMonth <= 12) {
    updateData.end_month = endMonth
  }

  const { error } = await supabase
    .from('performance_deals')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
