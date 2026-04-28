import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { dealId, year, month, kpiValue, directCost, attachmentUrl, sendEmail } = await req.json()

  // 본인 거래인지 검증
  const { data: deal } = await supabase
    .from('performance_deals')
    .select('id, title')
    .eq('id', dealId)
    .eq('employee_id', employee.id)
    .eq('is_active', true)
    .single()

  if (!deal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('monthly_kpi')
    .select('id')
    .eq('performance_deal_id', dealId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    await supabase.from('monthly_kpi')
      .update({
        kpi_value: kpiValue,
        direct_cost: directCost,
        ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('monthly_kpi').insert({
      performance_deal_id: dealId,
      year, month,
      kpi_value: kpiValue,
      direct_cost: directCost,
      purchase_cost: 0,
      external_purchase_cost: 0,
      ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
    })
  }

  // 이메일 발송 (고형석에게)
  if (sendEmail && attachmentUrl && process.env.RESEND_API_KEY) {
    try {
      const { data: admin } = await supabase
        .from('employees')
        .select('email, name')
        .eq('name', '고형석')
        .single()

      if (admin?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@emoney.app',
          to: admin.email,
          subject: `[E머니] ${employee.name} KPI 입력 알림 — ${year}년 ${month}월`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1d4ed8;">📊 KPI 입력 알림</h2>
              <p><strong>${employee.name}</strong>님이 ${year}년 ${month}월 KPI를 입력했습니다.</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tr style="background: #f3f4f6;">
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">거래</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${deal.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">KPI 값</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${kpiValue} 백만원</td>
                </tr>
                <tr style="background: #f3f4f6;">
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">직접비</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${directCost} 백만원</td>
                </tr>
              </table>
              <p>
                📎 <a href="${attachmentUrl}" style="color: #1d4ed8;">근거자료 보기</a>
              </p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
                관리자 페이지에서 매입비를 반영하면 최종 E머니가 확정됩니다.
              </p>
            </div>
          `,
        })
      }
    } catch (e) {
      // 이메일 실패해도 KPI 저장은 유지
      console.error('Email send failed:', e)
    }
  }

  return NextResponse.json({ success: true })
}
