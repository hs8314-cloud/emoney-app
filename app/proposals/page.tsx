import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import ProposalTabs from './ProposalTabs'

export default async function ProposalsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('*, affiliation:affiliations(*)')
    .eq('email', user.email)
    .single()

  if (!me) redirect('/login')

  // 1. 활성 거래 (본인의 performance_deals) - partner 정보 포함
  const { data: activeDeals } = await supabase
    .from('performance_deals')
    .select('*, partner:employees!performance_deals_partner_id_fkey(id, name, email, affiliation:affiliations(code))')
    .eq('employee_id', me.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // 2. 받은 승인 요청 (pending)
  const { data: receivedPending } = await supabase
    .from('deal_proposals')
    .select('*, proposer:employees!deal_proposals_proposer_id_fkey(name, affiliation:affiliations(code))')
    .eq('receiver_id', me.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // 3. 보낸 승인 요청 (pending)
  const { data: sentPending } = await supabase
    .from('deal_proposals')
    .select('*, receiver:employees!deal_proposals_receiver_id_fkey(name, affiliation:affiliations(code))')
    .eq('proposer_id', me.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // 4. 처리 완료된 제안 (accepted/rejected)
  const { data: closedProposals } = await supabase
    .from('deal_proposals')
    .select(`
      *,
      proposer:employees!deal_proposals_proposer_id_fkey(name, affiliation:affiliations(code)),
      receiver:employees!deal_proposals_receiver_id_fkey(name, affiliation:affiliations(code))
    `)
    .or(`proposer_id.eq.${me.id},receiver_id.eq.${me.id}`)
    .in('status', ['accepted', 'rejected'])
    .order('updated_at', { ascending: false })

  // 5. 전체 직원 (제안 폼용)
  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, name, affiliation:affiliations(code)')
    .eq('is_active', true)
    .neq('id', me.id)
    .order('name')

  const backUrl = me.role === 'admin' ? '/admin' : '/dashboard'
  const pendingCount = (receivedPending?.length ?? 0) + (sentPending?.length ?? 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-gray-400 hover:text-gray-600 text-sm">← 돌아가기</Link>
          <h1 className="font-bold text-gray-900">성과거래</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <ProposalTabs
          activeDeals={activeDeals || []}
          receivedPending={receivedPending || []}
          sentPending={sentPending || []}
          closedProposals={closedProposals || []}
          allEmployees={allEmployees || []}
          meId={me.id}
          pendingCount={pendingCount}
        />
      </main>
    </div>
  )
}
