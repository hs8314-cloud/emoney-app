import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import PasswordChangeForm from './PasswordChangeForm'

export default async function SettingsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*, affiliation:affiliations(*)')
    .eq('email', user.email)
    .single()

  const backUrl = employee?.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <Link href={backUrl} className="text-gray-400 hover:text-gray-600 text-sm">← 돌아가기</Link>
        <h1 className="font-bold text-gray-900">설정</h1>
      </header>
      <main className="max-w-md mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-800 mb-1">비밀번호 변경</h2>
          <p className="text-sm text-gray-400 mb-6">초기 비밀번호(Emoney2026!)를 변경해주세요</p>
          <PasswordChangeForm />
        </div>
      </main>
    </div>
  )
}
