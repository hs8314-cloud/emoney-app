'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProposalResponseButtons({ proposalId }: { proposalId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function respond(status: 'accepted' | 'rejected') {
    setLoading(true)
    await fetch(`/api/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond('accepted')}
        disabled={loading}
        className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >수락</button>
      <button
        onClick={() => respond('rejected')}
        disabled={loading}
        className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
      >거절</button>
    </div>
  )
}
