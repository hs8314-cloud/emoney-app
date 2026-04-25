import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status } = await req.json()
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('id').eq('email', user.email).single()

  // 제안 조회 (수신자 본인 건만)
  const { data: proposal, error: fetchError } = await supabase
    .from('deal_proposals')
    .select('*')
    .eq('id', id)
    .eq('receiver_id', me?.id)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: '제안을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 상태 업데이트
  const { error } = await supabase
    .from('deal_proposals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 수락 시 → performance_deals에 자동 등록
  if (status === 'accepted') {
    const { error: dealError } = await supabase
      .from('performance_deals')
      .insert({
        employee_id: proposal.proposer_id,
        title: proposal.title,
        calc_logic: proposal.calc_logic,
        ratio: proposal.ratio,
        is_active: true,
      })

    if (dealError) return NextResponse.json({ error: '성과거래 등록 실패: ' + dealError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
