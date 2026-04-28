import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendProposalResponseNotification } from '@/lib/email'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status } = await req.json()
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('id, name').eq('email', user.email).single()

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

  // 제안자 정보 조회 (이메일 알림용)
  const { data: proposer } = await supabase
    .from('employees').select('name, email').eq('id', proposal.proposer_id).single()

  if (status === 'accepted') {
    if (proposal.proposal_type === 'modify' && proposal.related_deal_id) {
      // 변경 요청 수락 → 기존 거래 업데이트
      const { error: dealError } = await supabase
        .from('performance_deals')
        .update({
          title: proposal.title,
          calc_logic: proposal.calc_logic,
          ratio: proposal.ratio,
          start_month: proposal.start_month ?? 1,
          end_month: proposal.end_month ?? 12,
        })
        .eq('id', proposal.related_deal_id)

      if (dealError) return NextResponse.json({ error: '거래 업데이트 실패: ' + dealError.message }, { status: 500 })
    } else {
      // 새 제안 수락 → performance_deals에 자동 등록 (partner_id 포함)
      const { error: dealError } = await supabase
        .from('performance_deals')
        .insert({
          employee_id: proposal.proposer_id,
          partner_id: proposal.receiver_id,
          title: proposal.title,
          calc_logic: proposal.calc_logic,
          ratio: proposal.ratio,
          is_active: true,
          start_month: proposal.start_month ?? 1,
          end_month: proposal.end_month ?? 12,
        })
      if (dealError) return NextResponse.json({ error: '성과거래 등록 실패: ' + dealError.message }, { status: 500 })
    }
  }

  // 제안자에게 이메일 알림
  if (proposer?.email) {
    await sendProposalResponseNotification({
      toEmail: proposer.email,
      toName: proposer.name,
      fromName: me!.name,
      title: proposal.title,
      status: status as 'accepted' | 'rejected',
      isModify: proposal.proposal_type === 'modify',
    })
  }

  return NextResponse.json({ success: true })
}
