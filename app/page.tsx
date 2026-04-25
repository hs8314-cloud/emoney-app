import { getAllEmployeeResults } from '@/lib/queries'

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function fmt(n: number) {
  return n.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default async function Home() {
  // 기본: 2026년 3월 (1분기 마지막)
  const results = await getAllEmployeeResults(2026, 3).catch(() => [])

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">E머니 성과 현황</h1>
          <p className="text-gray-500 text-sm mt-1">2026년 3월 기준 · 단위: 백만원</p>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">소속</th>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">성과거래</th>
                <th className="px-4 py-3 text-right">번돈</th>
                <th className="px-4 py-3 text-right">쓴돈</th>
                <th className="px-4 py-3 text-right">급여</th>
                <th className="px-4 py-3 text-right font-semibold">남는돈</th>
                <th className="px-4 py-3 text-right">배수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다</td>
                </tr>
              ) : (
                results.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.affiliation === 'TC' ? 'bg-blue-100 text-blue-700' :
                        r.affiliation === 'SAVI' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>{r.affiliation}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.title}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(r.earned)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{fmt(r.spent)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{fmt(r.salary)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(r.remaining)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${r.multiplier >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {r.multiplier.toFixed(1)}x
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
