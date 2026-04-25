'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

type Employee = { id: string; name: string; affiliation: any }

export default function ProposalForm({ employees, proposerId }: { employees: Employee[], proposerId: string }) {
  const router = useRouter()
  const [receiverId, setReceiverId] = useState('')
  const [title, setTitle] = useState('')
  const [calcLogic, setCalcLogic] = useState('')
  const [ratio, setRatio] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!receiverId) return
    setLoading(true)
    const res = await fetch('/api/proposals/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: receiverId,
        title,
        calc_logic: calcLogic,
        ratio: parseFloat(ratio) / 100,
        description: description || null,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setSent(true)
      setReceiverId(''); setTitle(''); setCalcLogic(''); setRatio(''); setDescription('')
      setTimeout(() => { setSent(false); router.refresh() }, 1500)
    } else {
      alert('전송 실패: ' + data.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">매입자 선택</label>
        <select
          value={receiverId}
          onChange={e => setReceiverId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">-- 매입자를 선택하세요 --</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              [{Array.isArray(emp.affiliation) ? emp.affiliation[0]?.code : emp.affiliation?.code}]{' '}{emp.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">거래 제목</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예) 신규 소재 공동 개발 매출 달성"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">산출 로직</label>
          <input
            type="text"
            value={calcLogic}
            onChange={e => setCalcLogic(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예) 매총익, 영업이익"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">비율 (%)</label>
          <input
            type="number"
            value={ratio}
            onChange={e => setRatio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예) 25"
            min="0" max="100" step="0.1"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">상세 설명 (선택)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="거래 조건, 기간, 목표 등을 자유롭게 작성하세요"
          rows={3}
        />
      </div>
      {sent && <p className="text-sm text-emerald-600">✓ 제안이 전송되었습니다!</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? '전송 중...' : '제안 보내기'}
      </button>
    </form>
  )
}
