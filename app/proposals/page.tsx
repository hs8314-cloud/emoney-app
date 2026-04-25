import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import ProposalForm from './ProposalForm'
import ProposalResponseButtons from '@/components/ProposalResponseButtons'

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

  // 전체 직원 목록 (본인 제외, 수신자 선택용)
  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, name, affiliation:affiliations(code)')
    .eq('is_active', true)
    .neq('id', me.id)
    .order('name')

  // 내가 보낸 제안
  const { data: sent } = await supabase
    .from('deal_proposals')
    .select('*, receiver:employees!deal_proposals_receiver_id_fkey(name, affiliation:affiliations(code))')
    .eq('proposer_id', me.id)
    .order('created_at', { ascending: false })

  // 내가 받은 제안
  const { data: received } = await supabase
    .from('deal_proposals')
    .select('*, proposer:employees!deal_proposals_proposer_id_fkey(name, affiliation:affiliations(code))')
    .eq('receiver_id', me.id)
    .order('created_at', { ascending: false })

  const backUrl = me.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-gray-400 hover:text-gray-600 text-sm">← 돌아가기</Link>
          <h1 className="font-bold text-gray-900">성과거래 제안</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">

        {/* 새 제안 작성 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">새 거래 제안하기</h2>
          <ProposalForm employees={allEmployees || []} proposerId={me.id} />
        </div>

        {/* 받은 제안 */}
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">받은 제안 ({received?.length ?? 0})</h2>
          <div className="space-y-3">
            {received?.length === 0 && <p className="text-sm text-gray-400">받은 제안이 없습니다.</p>}
            {received?.map(p => (
              <ProposalCard key={p.id} proposal={p} type="received" meId={me.id} />
            ))}
          </div>
        </div>

        {/* 보낸 제안 */}
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">보낸 제안 ({sent?.length ?? 0})</h2>
          <div className="space-y-3">
            {sent?.length === 0 && <p className="text-sm text-gray-400">보낸 제안이 없습니다.</p>}
            {sent?.map(p => (
              <ProposalCard key={p.id} proposal={p} type="sent" meId={me.id} />
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}

function ProposalCard({ proposal: p, type }: { proposal: any, type: 'sent' | 'received', meId: string }) {
  const counterpart = type === 'sent' ? p.receiver : p.proposer
  const statusLabel: Record<string, string> = { pending: '검토 중', accepted: '수락됨', rejected: '거절됨' }
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700'
  }
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            counterpart?.affiliation?.code === 'TC' ? 'bg-blue-100 text-blue-700' :
            counterpart?.affiliation?.code === 'SAVI' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>{counterpart?.affiliation?.code}</span>
          <span className="text-sm font-medium text-gray-700">
            {type === 'sent' ? `→ ${counterpart?.name}` : `← ${counterpart?.name}`}
          </span>
        </div>
        <p className="font-semibold text-gray-900">{p.title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{p.calc_logic} · {(p.ratio * 100).toFixed(0)}%</p>
        {p.description && <p className="text-sm text-gray-400 mt-1">{p.description}</p>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[p.status]}`}>
          {statusLabel[p.status]}
        </span>
        {type === 'received' && p.status === 'pending' && (
          <ProposalResponseButtons proposalId={p.id} />
        )}
      </div>
    </div>
  )
}

