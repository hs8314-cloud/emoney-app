import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendProposalCancelNotification } from '@/lib/email'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees').select('id, name').eq('email', user.email).single()

  // 제안 정보 조회 (취소 전에 수신자 정보 가져오기)
  const { data: proposal } = await supabase
    .from('deal_proposals')
    .select('id, title, receiver_id, status, proposer_id')
    .eq('id', id)
    .eq('proposer_id', me?.id)
    .eq('status', 'pending')
    .single()

  if (!proposal) return NextResponse.json({ error: '취소할 수 없는 제안입니다' }, { status: 404 })

  // 제안 삭제
  const { error } = await supabase
    .from('deal_proposals')
    .delete()
    .eq('id', id)
    .eq('proposer_id', me?.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 수신자에게 취소 메일 발송
  try {
    const { data: receiver } = await supabase
      .from('employees')
      .select('name, email')
      .eq('id', proposal.receiver_id)
      .single()

    if (receiver?.email) {
      await sendProposalCancelNotification({
        toEmail: receiver.email,
        toName: receiver.name,
        fromName: me?.name ?? '알 수 없음',
        title: proposal.title,
      })
    }
  } catch {
    // 메일 실패는 무시 (취소 자체는 성공)
  }

  return NextResponse.json({ success: true })
}
