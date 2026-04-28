// 서버 컴포넌트 — 날짜 기반 자동 메시지
export default function NoticeBanner() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = now.getDate()
  const month = now.getMonth() + 1
  const nextMonth = month === 12 ? 1 : month + 1

  // 15~18일: KPI 입력 기간
  if (day >= 15 && day <= 18) {
    const daysLeft = 18 - day
    return (
      <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">📝</span>
          <div>
            <span className="font-bold">{month}월 KPI 입력 기간입니다</span>
            <span className="ml-2 text-blue-200 text-sm">
              {daysLeft === 0 ? '오늘이 마감일입니다!' : `${daysLeft}일 남았습니다 · ${month}월 18일 마감`}
            </span>
          </div>
        </div>
        <a href="/kpi"
          className="bg-white text-blue-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
          KPI 입력하기 →
        </a>
      </div>
    )
  }

  // 19일: 마감 후
  if (day === 19) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
        <span>⚠️</span>
        <p className="text-sm text-amber-800">
          <strong>{month}월 KPI 입력 기간이 종료됐습니다.</strong> 미입력 시 관리자에게 문의해주세요.
        </p>
      </div>
    )
  }

  // 20일: 결과 공유일
  if (day === 20) {
    return (
      <div className="bg-emerald-600 text-white px-6 py-3 flex items-center gap-3">
        <span className="text-lg">📊</span>
        <p className="text-sm">
          <strong>{month}월 E머니 결과가 오늘 이메일로 공유됩니다.</strong> 잠시 후 메일함을 확인해주세요.
        </p>
      </div>
    )
  }

  // 그 외: 다음 입력 기간 안내
  const nextInputMonth = day < 15 ? month : nextMonth
  const daysUntil = day < 15 ? 15 - day : (new Date(now.getFullYear(), month, 15).getDate() - day + 30)

  return (
    <div className="bg-gray-100 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>📅</span>
        <span>
          <strong>KPI 입력 기간:</strong> 매월 15일~18일 &nbsp;·&nbsp;
          <strong>결과 공유:</strong> 매월 20일
        </span>
        {day < 15 && (
          <span className="ml-2 text-gray-400">({nextInputMonth}월 15일까지 {daysUntil}일)</span>
        )}
      </div>
      <a href="/kpi" className="text-xs text-blue-600 hover:underline">KPI 미리 입력</a>
    </div>
  )
}
