import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import UploadForm from './UploadForm'

export default async function KpiUploadPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  // 분리 조회 (Supabase nested join 버그 우회)
  const [{ data: allDeals }, { data: allEmps }] = await Promise.all([
    supabase.from('performance_deals').select('id, title, ratio, employee_id, partner_id').eq('is_active', true),
    supabase.from('employees').select('id, name'),
  ])

  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [e.id, e]))

  const deals = (allDeals || [])
    .map((d: any) => ({
      id: d.id,
      title: d.title,
      ratio: d.ratio,
      employee: empMap[d.employee_id] ? { id: empMap[d.employee_id].id, name: empMap[d.employee_id].name } : null,
      partner: empMap[d.partner_id] ? { id: empMap[d.partner_id].id, name: empMap[d.partner_id].name } : null,
    }))
    .filter((d: any) => d.employee)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <Link href="/admin/kpi" className="text-gray-400 hover:text-gray-600 text-sm">← KPI 입력</Link>
        <h1 className="font-bold text-gray-900">AMIS 데이터 업로드</h1>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold text-blue-900 text-sm">💡 사용 방법</p>
          <p>① AMIS에서 월별 성과 데이터를 CSV로 내보내기</p>
          <p>② 파일 업로드 후 <strong>이름 컬럼 / KPI값 컬럼</strong> 선택 (직접비 컬럼은 선택사항)</p>
          <p>③ 미리보기에서 번돈·남는돈·매입 기여액 확인 후 <strong>확정 저장</strong></p>
          <p className="text-blue-600">→ 저장 즉시 매입자의 purchase_cost가 자동 계산·반영됩니다</p>
        </div>
        <UploadForm deals={deals} />
      </main>
    </div>
  )
}
