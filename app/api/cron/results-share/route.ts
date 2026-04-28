import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { Resend } from 'resend'

const FROM = 'E머니 <onboarding@resend.dev>'

function fmt(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createSupabaseServer()
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const month = now.getMonth() + 1
  // 20일 발송 = 전월 결과 공유 (입력은 15~18일, 결과는 20일)
  const targetMonth = month === 1 ? 12 : month - 1
  const year = targetMonth === 12 && month === 1 ? now.getFullYear() - 1 : now.getFullYear()

  // 활성 직원 전체 조회
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, email, salary')
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!employees?.length) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const emp of employees) {
    try {
      // 해당 직원의 deals
      const { data: deals } = await supabase
        .from('performance_deals')
        .select('id, title, ratio')
        .eq('employee_id', emp.id)

      if (!deals?.length) continue

      const dealIds = deals.map((d: any) => d.id)
      const dealMap = Object.fromEntries(deals.map((d: any) => [d.id, d]))

      // 해당 월 KPI
      const { data: kpiRows } = await supabase
        .from('monthly_kpi')
        .select('*')
        .in('performance_deal_id', dealIds)
        .eq('year', year)
        .eq('month', targetMonth)

      if (!kpiRows?.length) continue

      // 계산
      const dealResults = kpiRows.map((r: any) => {
        const deal = dealMap[r.performance_deal_id]
        const earned = r.kpi_value * deal.ratio
        const spent = r.direct_cost + r.purchase_cost + (r.external_purchase_cost ?? 0)
        const remaining = earned - spent
        const multiplier = emp.salary * 2 > 0 ? remaining / (emp.salary * 2) : 0
        return { title: deal.title, kpi: r.kpi_value, earned, spent, remaining, multiplier }
      })

      const totalEarned = dealResults.reduce((s, d) => s + d.earned, 0)
      const totalSpent = dealResults.reduce((s, d) => s + d.spent, 0)
      const totalRemaining = totalEarned - totalSpent
      const totalMultiplier = emp.salary * 2 > 0 ? totalRemaining / (emp.salary * 2) : 0

      const dealRows = dealResults.map(d => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #374151;">${d.title}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: #2563eb; font-weight: 600;">${fmt(d.earned)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: #ef4444;">${fmt(d.spent)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 700; color: ${d.remaining >= 0 ? '#059669' : '#dc2626'};">${fmt(d.remaining)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${d.multiplier >= 1 ? '#059669' : '#6b7280'};">${fmt(d.multiplier)}x</td>
        </tr>
      `).join('')

      await resend.emails.send({
        from: FROM,
        to: emp.email,
        subject: `[E머니] ${targetMonth}월 결과 공유 — ${fmt(totalRemaining)} 백만원`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #059669; margin-bottom: 4px;">📊 ${targetMonth}월 E머니 결과</h2>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">${year}년 ${targetMonth}월 · 단위: 백만원</p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-weight: 500;">거래</th>
                  <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 500;">번돈</th>
                  <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 500;">쓴돈</th>
                  <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 500;">남는돈</th>
                  <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 500;">배수</th>
                </tr>
              </thead>
              <tbody>${dealRows}</tbody>
              <tfoot>
                <tr style="background: #f0fdf4; border-top: 2px solid #bbf7d0;">
                  <td style="padding: 12px; font-weight: 700; color: #111827;">합계</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #2563eb;">${fmt(totalEarned)}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #ef4444;">${fmt(totalSpent)}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: ${totalRemaining >= 0 ? '#059669' : '#dc2626'}; font-size: 16px;">${fmt(totalRemaining)}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: ${totalMultiplier >= 1 ? '#059669' : '#6b7280'};">${fmt(totalMultiplier)}x</td>
                </tr>
              </tfoot>
            </table>

            <a href="https://emoney-app.vercel.app/dashboard"
               style="display: inline-block; background: #059669; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              내 대시보드 보기 →
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템 · 자동 발송 메일입니다</p>
          </div>
        `,
      })
      sent++
    } catch (e) {
      console.error(`Failed to send results to ${emp.email}:`, e)
    }
  }

  return NextResponse.json({ success: true, sent, targetMonth, year })
}
