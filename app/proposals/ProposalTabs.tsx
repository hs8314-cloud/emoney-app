'use client'
import { useState } from 'react'
import ProposalForm from './ProposalForm'
import ProposalResponseButtons from '@/components/ProposalResponseButtons'
import ProposalCancelButton from '@/components/ProposalCancelButton'
import ActiveDealCard from '@/components/ActiveDealCard'

const STATUS_LABEL: Record<string, string> = { pending: '검토 중', accepted: '수락됨', rejected: '거절됨' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

function AffiBadge({ code }: { code?: string }) {
  const color = code === 'TC' ? 'bg-blue-100 text-blue-700'
    : code === 'SAVI' ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>{code}</span>
}

export default function ProposalTabs({
  activeDeals, receivedPending, sentPending, closedProposals, allEmployees, meId, mySalary, pendingCount
}: {
  activeDeals: any[]
  receivedPending: any[]
  sentPending: any[]
  closedProposals: any[]
  allEmployees: any[]
  meId: string
  mySalary: number
  pendingCount: number
}) {
  const [tab, setTab] = useState<'active' | 'pending' | 'new'>('active')

  const tabs = [
    { key: 'active', label: '활성 거래', count: activeDeals.filter((d: any) => d.is_active).length },
    { key: 'pending', label: '승인 요청', count: pendingCount },
    { key: 'new', label: '새 제안', count: null },
  ] as const

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 활성 거래 탭 */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeDeals.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
              활성화된 성과거래가 없습니다
            </div>
          ) : activeDeals.map((deal: any) => (
            <ActiveDealCard key={deal.id} deal={deal} salary={mySalary} />
          ))}
        </div>
      )}

      {/* 승인 요청 탭 */}
      {tab === 'pending' && (
        <div className="space-y-6">
          {/* 받은 요청 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              받은 요청 ({receivedPending.length})
            </h3>
            <div className="space-y-3">
              {receivedPending.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">받은 요청이 없습니다</p>
              ) : receivedPending.map((p: any) => (
                <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.proposal_type === 'modify' ? 'border-amber-200' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AffiBadge code={p.proposer?.affiliation?.code ?? p.proposer?.affiliation?.[0]?.code} />
                        <span className="text-sm font-medium text-gray-700">← {p.proposer?.name}</span>
                        {p.proposal_type === 'modify' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">변경요청</span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900">{p.title}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.calc_logic} · <span className="text-blue-600 font-medium">{(p.ratio * 100).toFixed(0)}%</span>
                      </p>
                      {p.description && <p className="text-sm text-gray-400 mt-2">{p.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('ko-KR')}</p>
                      <ProposalResponseButtons proposalId={p.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 보낸 요청 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              보낸 요청 ({sentPending.length})
            </h3>
            <div className="space-y-3">
              {sentPending.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">보낸 요청이 없습니다</p>
              ) : sentPending.map((p: any) => (
                <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.proposal_type === 'modify' ? 'border-amber-200' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AffiBadge code={p.receiver?.affiliation?.code ?? p.receiver?.affiliation?.[0]?.code} />
                        <span className="text-sm font-medium text-gray-700">→ {p.receiver?.name}</span>
                        {p.proposal_type === 'modify' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">변경요청</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR['pending']}`}>
                          {STATUS_LABEL['pending']}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{p.title}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.calc_logic} · <span className="text-blue-600 font-medium">{(p.ratio * 100).toFixed(0)}%</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('ko-KR')}</p>
                      <ProposalCancelButton proposalId={p.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 처리 완료 */}
          {closedProposals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                처리 완료 ({closedProposals.length})
              </h3>
              <div className="space-y-3">
                {closedProposals.map((p: any) => {
                  const isSent = p.proposer_id === meId
                  const counterpart = isSent ? p.receiver : p.proposer
                  const affCode = counterpart?.affiliation?.code ?? counterpart?.affiliation?.[0]?.code
                  return (
                    <div key={p.id} className="bg-white rounded-xl border p-5 opacity-70">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AffiBadge code={affCode} />
                            <span className="text-sm text-gray-600">
                              {isSent ? `→ ${counterpart?.name}` : `← ${counterpart?.name}`}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>
                              {STATUS_LABEL[p.status]}
                            </span>
                          </div>
                          <p className="font-medium text-gray-700">{p.title}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {p.calc_logic} · {(p.ratio * 100).toFixed(0)}%
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">{new Date(p.updated_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 새 제안 탭 */}
      {tab === 'new' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-6">매입자를 선택하고 성과거래 조건을 작성하세요</p>
          <ProposalForm employees={allEmployees} proposerId={meId} onSent={() => setTab('pending')} />
        </div>
      )}
    </div>
  )
}
