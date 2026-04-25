import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// 거래 수정 (제목, calc_logic, ratio)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { title, calc_logic, ratio } = await req.json()
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('id').eq('email', user.email).single()

  const { error } = await supabase
    .from('performance_deals')
    .update({ title, calc_logic, ratio })
    .eq('id', id)
    .eq('employee_id', me?.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 거래 삭제 (비활성화)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('id').eq('email', user.email).single()

  const { error } = await supabase
    .from('performance_deals')
    .update({ is_active: false })
    .eq('id', id)
    .eq('employee_id', me?.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
