import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { Resend } from 'resend'

const FROM = 'E머니 <onboarding@resend.dev>'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export async function GET(req: Request) {
  // 관리자만 호출 가능
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'reminder' // reminder | results

  // 고형석 정보 조회
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, email, salary')
    .eq('name', '고형석')
    .single()

  if (!emp?.email) return NextResponse.json({ error: '고형석 이메일 없음' }, { status: 404 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const month = now.getMonth() + 1

  if (type === 'reminder') {
    // KPI 입력 안내 이메일
    await resend.emails.send({
      from: FROM,
      to: emp.email,
      subject: `[테스트] [E머니] ${month}월 KPI 입력 기간 안내 (${month}월 18일까지)`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <p style="background:#fef3c7;padding:8px 12px;border-radius:6px;font-size:13px;color:#92400e;">🧪 테스트 발송</p>
          <h2 style="color: #1d4ed8; margin-bottom: 8px;">📝 ${month}월 KPI 입력 기간입니다</h2>
          <p style="color: #374151; margin-bottom: 24px;">
            ${emp.name}님, 안녕하세요.<br/>
            이번 달 KPI 입력 기간(<strong>${month}월 15일~18일</strong>)이 시작되었습니다.<br/>
            아래 버튼을 눌러 실적을 입력해주세요.
          </p>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #1e40af; font-weight: 600;">📅 일정 안내</p>
            <p style="margin: 0 0 4px; color: #374151; font-size: 14px;">· KPI 입력 마감: <strong>${month}월 18일</strong></p>
            <p style="margin: 0; color: #374151; font-size: 14px;">· 결과 공유: <strong>${month}월 20일</strong> (이메일 자동 발송)</p>
          </div>
          <a href="https://emoney-app.vercel.app/kpi"
             style="display: inline-block; background: #1d4ed8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            KPI 입력하기 →
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템 · 자동 발송 메일입니다</p>
        </div>
      `,
    })
    return NextResponse.json({ success: true, type: 'reminder', to: emp.email })
  }

  // results 타입: 고형석의 이번 달 결과
  const { data: deals } = await supabase
    .from('performance_deals')
    .select('id, title, ratio')
    .eq('employee_id', emp.id)

  const dealIds = (deals || []).map((d: any) => d.id)
  const dealMap = Object.fromEntries((deals || []).map((d: any) => [d.id, d]))

  const { data: kpiRows } = dealIds.length > 0
    ? await supabase.from('monthly_kpi').select('*').in('performance_deal_id', dealIds).eq('year', 2026).eq('month', month)
    : { data: [] }

  const dealResults = (kpiRows || []).map((r: any) => {
    const deal = dealMap[r.performance_deal_id]
    if (!deal) return null
    const earned = r.kpi_value * deal.ratio
    const spent = r.direct_cost + r.purchase_cost + (r.external_purchase_cost ?? 0)
    const remaining = earned - spent
    const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
    return { title: deal.title, earned, spent, remaining, multiplier }
  }).filter(Boolean)

  const totalEarned = dealResults.reduce((s: number, d: any) => s + d.earned, 0)
  const totalSpent = dealResults.reduce((s: number, d: any) => s + d.spent, 0)
  const totalRemaining = totalEarned - totalSpent
  const totalMultiplier = emp.salary * 2 > 0 ? totalRemaining / (emp.salary * 2) : 0

  const dealRows = dealResults.map((d: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${d.title}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#2563eb;font-weight:600;">${fmt(d.earned)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#ef4444;">${fmt(d.spent)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${d.remaining >= 0 ? '#059669' : '#dc2626'};">${fmt(d.remaining)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:${d.multiplier >= 1 ? '#059669' : '#6b7280'};">${fmt(d.multiplier)}x</td>
    </tr>
  `).join('')

  await resend.emails.send({
    from: FROM,
    to: emp.email,
    subject: `[테스트] [E머니] ${month}월 결과 공유 — ${fmt(totalRemaining)} 백만원`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <p style="background:#fef3c7;padding:8px 12px;border-radius:6px;font-size:13px;color:#92400e;">🧪 테스트 발송</p>
        <h2 style="color: #059669; margin-bottom: 4px;">📊 ${month}월 E머니 결과</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">2026년 ${month}월 · 단위: 백만원</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:500;">거래</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;">번돈</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;">쓴돈</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;">남는돈</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;">배수</th>
            </tr>
          </thead>
          <tbody>${dealRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af;">이번 달 KPI 데이터 없음</td></tr>'}</tbody>
          <tfoot>
            <tr style="background:#f0fdf4;border-top:2px solid #bbf7d0;">
              <td style="padding:12px;font-weight:700;color:#111827;">합계</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#2563eb;">${fmt(totalEarned)}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#ef4444;">${fmt(totalSpent)}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:${totalRemaining >= 0 ? '#059669' : '#dc2626'};font-size:16px;">${fmt(totalRemaining)}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:${totalMultiplier >= 1 ? '#059669' : '#6b7280'};">${fmt(totalMultiplier)}x</td>
            </tr>
          </tfoot>
        </table>
        <a href="https://emoney-app.vercel.app/dashboard"
           style="display:inline-block;background:#059669;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
          내 대시보드 보기 →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;">E머니 성과 포인트 시스템 · 자동 발송 메일입니다</p>
      </div>
    `,
  })

  return NextResponse.json({ success: true, type: 'results', to: emp.email, month })
}
