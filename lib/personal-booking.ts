import { format } from "date-fns";

/** 个人邀请页通知邮箱（FormSubmit）。更换后需重新激活验证邮件。 */
export const PERSONAL_NOTIFY_EMAIL = "18096095446@163.com";

export type PersonalBookingPayload = {
  bookingId: string;
  applicantName: string;
  applicantEmail?: string;
  date: string;
  time: string;
  plan: string;
  note: string;
  origin: string;
};

/** 产品约定编号：QQ-日期-四位随机数 */
export function createPersonalBookingId(date: Date) {
  const datePart = format(date, "yyyyMMdd");
  const randomPart = String(Math.floor(1000 + Math.random() * 9000));
  return `QQ-${datePart}-${randomPart}`;
}

export async function sendPersonalBookingEmail(payload: PersonalBookingPayload) {
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(PERSONAL_NOTIFY_EMAIL)}`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: `${payload.applicantName} 发来新的周末约会预约｜${payload.date} ${payload.time}`,
        _template: "table",
        _url: payload.origin,
        预约编号: payload.bookingId,
        申请人: payload.applicantName,
        申请人邮箱: payload.applicantEmail || "未填写",
        预约日期: payload.date,
        预约时间: payload.time,
        约会计划: payload.plan,
        悄悄话: payload.note || "没有留言",
      }),
    },
  );

  if (!response.ok) {
    throw new Error("信鸽暂时迷路了，请再试一次。你的选择都还在。");
  }

  return response;
}
