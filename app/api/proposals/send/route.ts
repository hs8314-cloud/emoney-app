import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendProposalNotification, sendDealModifyRequestNotification } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { receiver_id, title, calc_logic, ratio, description, proposal_type, related_deal_id, start_month, end_month } = body

  // 제안자 정보
  const { data: proposer } = await supabase
    .from('employees').select('id, name').eq('email', user.email).single()

  // 수신자 정보 (이메일 포함)
  const { data: receiver } = await supabase
    .from('employees').select('id, name, email').eq('id', receiver_id).single()

  if (!proposer || !receiver) {
    return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  // DB 저장
  const { error: insertError } = await supabase.from('deal_proposals').insert({
    proposer_id: proposer.id,
    receiver_id,
    title,
    calc_logic,
    ratio,
    description: description || null,
    status: 'pending',
    proposal_type: proposal_type || 'new',
    related_deal_id: related_deal_id || null,
    start_month: start_month ?? 1,
    end_month: end_month ?? 12,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // 이메일 발송
  if (proposal_type === 'modify') {
    await sendDealModifyRequestNotification({
      toEmail: receiver.email,
      toName: receiver.name,
      fromName: proposer.name,
      title,
      calcLogic: calc_logic,
      ratio,
    })
  } else {
    await sendProposalNotification({
      toEmail: receiver.email,
      toName: receiver.name,
      fromName: proposer.name,
      title,
      calcLogic: calc_logic,
      ratio,
      description,
    })
  }

  return NextResponse.json({ success: true })
}
