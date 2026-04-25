import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'E머니 <onboarding@resend.dev>'

// 새 거래 제안 알림 (수신자에게)
export async function sendProposalNotification({
  toEmail,
  toName,
  fromName,
  title,
  calcLogic,
  ratio,
  description,
}: {
  toEmail: string
  toName: string
  fromName: string
  title: string
  calcLogic: string
  ratio: number
  description?: string | null
}) {
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `[E머니] ${fromName}님이 성과거래를 제안했습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1d4ed8;">E머니 성과거래 제안</h2>
        <p style="color: #374151;">${toName}님, 안녕하세요.<br/>
        <strong>${fromName}</strong>님이 새로운 성과거래를 제안했습니다.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">거래 제목</p>
          <p style="margin: 0 0 16px; font-weight: 600; color: #111827;">${title}</p>
          <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">산출 로직</p>
          <p style="margin: 0 0 16px; color: #111827;">${calcLogic} · ${(ratio * 100).toFixed(0)}%</p>
          ${description ? `
          <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">상세 설명</p>
          <p style="margin: 0; color: #374151;">${description}</p>
          ` : ''}
        </div>

        <a href="https://emoney-app.vercel.app/proposals"
           style="display: inline-block; background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          제안 확인하기 →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템</p>
      </div>
    `,
  })
}

// 거래 변경 승인요청 알림 (파트너에게)
export async function sendDealModifyRequestNotification({
  toEmail,
  toName,
  fromName,
  title,
  calcLogic,
  ratio,
}: {
  toEmail: string
  toName: string
  fromName: string
  title: string
  calcLogic: string
  ratio: number
}) {
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `[E머니] ${fromName}님이 거래 변경을 요청했습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #d97706;">거래 변경 승인 요청</h2>
        <p style="color: #374151;">${toName}님, 안녕하세요.<br/>
        <strong>${fromName}</strong>님이 기존 성과거래의 <strong>변경을 요청</strong>했습니다.<br/>
        성과거래 페이지에서 수락 또는 거절해주세요.</p>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #92400e;">변경 후 거래 내용</p>
          <p style="margin: 0 0 8px; font-weight: 600; color: #111827;">${title}</p>
          <p style="margin: 0; color: #374151;">${calcLogic} · ${(ratio * 100).toFixed(0)}%</p>
        </div>

        <a href="https://emoney-app.vercel.app/proposals"
           style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          승인 요청 확인하기 →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템</p>
      </div>
    `,
  })
}

// 취소 알림 (수신자에게)
export async function sendProposalCancelNotification({
  toEmail,
  toName,
  fromName,
  title,
}: {
  toEmail: string
  toName: string
  fromName: string
  title: string
}) {
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `[E머니] ${fromName}님이 거래 제안을 취소했습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #6b7280;">거래 제안 취소</h2>
        <p style="color: #374151;">${toName}님, 안녕하세요.<br/>
        <strong>${fromName}</strong>님이 아래 거래 제안을 <strong>취소</strong>했습니다.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">거래 제목</p>
          <p style="margin: 0; font-weight: 600; color: #111827;">${title}</p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템</p>
      </div>
    `,
  })
}

// 수락/거절 알림 (제안자에게)
export async function sendProposalResponseNotification({
  toEmail,
  toName,
  fromName,
  title,
  status,
  isModify = false,
}: {
  toEmail: string
  toName: string
  fromName: string
  title: string
  status: 'accepted' | 'rejected'
  isModify?: boolean
}) {
  const isAccepted = status === 'accepted'
  const actionLabel = isModify
    ? (isAccepted ? '변경 요청이 수락' : '변경 요청이 거절')
    : (isAccepted ? '거래 제안이 수락' : '거래 제안이 거절')

  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `[E머니] ${actionLabel}되었습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: ${isAccepted ? '#059669' : '#dc2626'};">
          ${actionLabel}되었습니다
        </h2>
        <p style="color: #374151;">${toName}님, 안녕하세요.<br/>
        <strong>${fromName}</strong>님이 회원님의 ${isModify ? '거래 변경 요청을' : '거래 제안을'}
        <strong style="color: ${isAccepted ? '#059669' : '#dc2626'};">${isAccepted ? '수락' : '거절'}</strong>했습니다.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">거래 제목</p>
          <p style="margin: 0; font-weight: 600; color: #111827;">${title}</p>
        </div>

        <a href="https://emoney-app.vercel.app/proposals"
           style="display: inline-block; background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          확인하기 →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">E머니 성과 포인트 시스템</p>
      </div>
    `,
  })
}
