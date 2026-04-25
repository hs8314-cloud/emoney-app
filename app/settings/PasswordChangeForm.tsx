'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function PasswordChangeForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setStatus('error')
      setMessage('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirm) {
      setStatus('error')
      setMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) {
      setStatus('error')
      setMessage('변경 실패: ' + error.message)
    } else {
      setStatus('success')
      setMessage('비밀번호가 변경되었습니다.')
      setNewPassword('')
      setConfirm('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="6자 이상"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="동일하게 입력"
          required
        />
      </div>
      {status === 'error' && <p className="text-sm text-red-500">{message}</p>}
      {status === 'success' && <p className="text-sm text-emerald-600">✓ {message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}
