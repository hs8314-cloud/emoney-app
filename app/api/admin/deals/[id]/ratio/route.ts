import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // body: { fromMonth: 4, ratio: 0.07 }
  const { fromMonth, ratio } = await req.json()

  // 기존 ratio_changes 불러와서 병합
  const { data: deal, error: fetchErr } = await supabase
    .from('performance_deals')
    .select('ratio_changes')
    .eq('id', id)
    .single()

  if (fetchErr) {
    console.error('[ratio PATCH] fetch error:', fetchErr)
    return NextResponse.json({ error: `fetch: ${fetchErr.message}` }, { status: 500 })
  }

  const current = (deal?.ratio_changes as Record<string, number>) ?? {}
  const updated = { ...current, [String(fromMonth)]: ratio }

  const { error } = await supabase
    .from('performance_deals')
    .update({ ratio_changes: updated })
    .eq('id', id)

  if (error) {
    console.error('[ratio PATCH] update error:', error)
    return NextResponse.json({ error: `update: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ success: true, ratio_changes: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // body: { fromMonth: 4 } → 해당 항목 제거
  const { fromMonth } = await req.json()

  const { data: deal } = await supabase
    .from('performance_deals')
    .select('ratio_changes')
    .eq('id', id)
    .single()

  const current = { ...((deal?.ratio_changes as Record<string, number>) ?? {}) }
  delete current[String(fromMonth)]

  const { error } = await supabase
    .from('performance_deals')
    .update({ ratio_changes: current })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, ratio_changes: current })
}
