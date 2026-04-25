'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProposalCancelButton({ proposalId }: { proposalId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    if (!confirm('제안을 취소하시겠습니까?')) return
    setLoading(true)
    await fetch(`/api/proposals/${proposalId}/cancel`, { method: 'DELETE' })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs border border-gray-300 text-gray-500 px-3 py-1 rounded hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      {loading ? '취소 중...' : '취소'}
    </button>
  )
}
