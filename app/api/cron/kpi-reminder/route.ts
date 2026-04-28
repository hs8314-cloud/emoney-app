import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { Resend } from 'resend'

const FROM = 'E머니 <onboarding@resend.dev>'

export async function GET(req: Request) {
  // Vercel Cron 인증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createSupabaseServer()
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const month = now.getMonth() + 1

  // 활성 직원 전체 조회
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, email')
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!employees?.length) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const emp of employees) {
    try {
      await resend.emails.send({
        from: FROM,
        to: emp.email,
        subject: `[E머니] ${month}월 KPI 입력 기간 안내 (${month}월 18일까지)`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
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
      sent++
    } catch (e) {
      console.error(`Failed to send to ${emp.email}:`, e)
    }
  }

  return NextResponse.json({ success: true, sent, month })
}
