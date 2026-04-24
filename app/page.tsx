import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: departments, error } = await supabase
    .from('departments')
    .select('*')

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">EMONEY - 부서별 성과 포인트</h1>
      {error ? (
        <p className="text-red-500">연결 오류: {error.message}</p>
      ) : (
        <p className="text-green-600">✓ Supabase 연결 성공 (부서 수: {departments?.length ?? 0})</p>
      )}
    </main>
  )
}
