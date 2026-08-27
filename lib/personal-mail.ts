import {
  PERSONAL_NOTIFY_EMAIL,
  type PersonalBookingPayload,
  sendPersonalBookingEmail,
} from "@/lib/personal-booking";
import { getPersonalEnv } from "@/lib/personal-data";
import type { PersonalBookingRow } from "@/lib/personal-data";

export { PERSONAL_NOTIFY_EMAIL, sendPersonalBookingEmail };
export type { PersonalBookingPayload };

export type MailResult = {
  sent: boolean;
  skipped: boolean;
  error?: string;
};

export async function notifyOwnerNewBooking(payload: PersonalBookingPayload): Promise<MailResult> {
  try {
    await sendPersonalBookingEmail(payload);
    return { sent: true, skipped: false };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "通知 QQ 失败",
    };
  }
}

export async function notifyApplicantDecision(
  booking: PersonalBookingRow,
  decision: "approved" | "rejected",
): Promise<MailResult> {
  const apiKey = getPersonalEnv("RESEND_API_KEY");
  const from = getPersonalEnv("RESEND_FROM_EMAIL") || "QQ Weekend <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      sent: false,
      skipped: true,
      error: "未配置 RESEND_API_KEY，请稍后在后台补发或手动邮件通知预约人",
    };
  }

  const approved = decision === "approved";
  const subject = approved
    ? `QQ 已同意你的周末预约｜${booking.date} ${booking.start_time}`
    : `关于你的周末预约｜${booking.date} ${booking.start_time}`;

  const body = approved
    ? [
        `${booking.applicant_name} 你好，`,
        ``,
        `QQ 已同意这次周末小冒险。`,
        `预约编号：${booking.booking_code}`,
        `时间：${booking.date} ${booking.start_time}`,
        `计划：${booking.plan}`,
        booking.note ? `你的留言：${booking.note}` : "",
        ``,
        `周末见。`,
      ]
    : [
        `${booking.applicant_name} 你好，`,
        ``,
        `这次预约 QQ 暂时没法赴约，档期已释放，欢迎以后再挑一个周末。`,
        `预约编号：${booking.booking_code}`,
        `原时间：${booking.date} ${booking.start_time}`,
        `计划：${booking.plan}`,
        ``,
        `谢谢你的邀请。`,
      ];

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [booking.applicant_email],
        subject,
        text: body.filter(Boolean).join("\n"),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, skipped: false, error: detail.slice(0, 240) || "发送失败" };
    }

    return { sent: true, skipped: false };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "发送失败",
    };
  }
}
