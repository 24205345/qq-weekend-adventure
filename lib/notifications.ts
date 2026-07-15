import { getD1 } from "@/db";
import { createId } from "@/lib/ids";

type NotificationBooking = {
  id: string;
  tenant_id: string;
  booking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  party_size: number;
  date: string;
  start_time: string;
  status: string;
  customer_note: string;
  custom_data: string;
  service_name: string;
  store_name: string;
  address: string;
  tenant_name: string;
  notification_email: string;
  contact_email: string;
};

async function loadBooking(bookingId: string, tenantId: string) {
  return getD1()
    .prepare(
      `SELECT b.id, b.tenant_id, b.booking_code, b.customer_name, b.customer_email,
              b.customer_phone, b.party_size, b.date, b.start_time, b.status,
              b.customer_note, b.custom_data, s.name AS service_name,
              st.name AS store_name, st.address, t.name AS tenant_name,
              s.notification_email, t.contact_email
       FROM bookings b
       JOIN booking_services s ON s.id = b.service_id
       JOIN stores st ON st.id = b.store_id
       JOIN tenants t ON t.id = b.tenant_id
       WHERE b.id = ? AND b.tenant_id = ? LIMIT 1`,
    )
    .bind(bookingId, tenantId)
    .first<NotificationBooking>();
}

function notificationPayload(booking: NotificationBooking) {
  let customData: Record<string, unknown> = {};
  try {
    customData = JSON.parse(booking.custom_data) as Record<string, unknown>;
  } catch {
    customData = {};
  }
  return {
    _subject: `${booking.customer_name} 提交了新的预约｜${booking.date} ${booking.start_time}`,
    _template: "table",
    预约编号: booking.booking_code,
    商户: booking.tenant_name,
    门店: booking.store_name,
    预约主题: booking.service_name,
    预约人: booking.customer_name,
    联系邮箱: booking.customer_email || "未填写",
    联系电话: booking.customer_phone || "未填写",
    预约人数: booking.party_size,
    日期: booking.date,
    时间: booking.start_time,
    状态: booking.status,
    备注: booking.customer_note || "无",
    自定义信息: Object.keys(customData).length ? JSON.stringify(customData) : "无",
  };
}

export async function sendMerchantBookingEmail(tenantId: string, bookingId: string) {
  const d1 = getD1();
  const booking = await loadBooking(bookingId, tenantId);
  if (!booking) return { status: "failed", error: "Booking not found" };
  const recipient = booking.notification_email || booking.contact_email;
  if (!recipient) return { status: "failed", error: "Notification email is empty" };

  const existing = await d1
    .prepare(
      `SELECT id, attempts FROM notification_logs
       WHERE tenant_id = ? AND booking_id = ? AND event_type = 'booking_created'
         AND channel = 'email' AND recipient = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(tenantId, bookingId, recipient)
    .first<{ id: string; attempts: number }>();
  const logId = existing?.id ?? createId("notification");
  if (!existing) {
    await d1
      .prepare(
        `INSERT INTO notification_logs
          (id, tenant_id, booking_id, event_type, channel, recipient, status, attempts)
         VALUES (?, ?, ?, 'booking_created', 'email', ?, 'queued', 0)`,
      )
      .bind(logId, tenantId, bookingId, recipient)
      .run();
  }

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(notificationPayload(booking)),
    });
    const responseBody = (await response.json().catch(() => null)) as {
      success?: string | boolean;
      message?: string;
    } | null;
    const activationPending =
      response.ok &&
      String(responseBody?.success) === "false" &&
      Boolean(responseBody?.message?.toLowerCase().includes("activation"));
    if (!response.ok || (String(responseBody?.success) === "false" && !activationPending)) {
      throw new Error(responseBody?.message || `Email provider returned ${response.status}`);
    }
    await d1
      .prepare(
        `UPDATE notification_logs
         SET status = ?, error = '', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(activationPending ? "activation_pending" : "sent", logId, tenantId)
      .run();
    return { status: activationPending ? "activation_pending" : "sent", error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown email error";
    await d1
      .prepare(
        `UPDATE notification_logs
         SET status = 'failed', error = ?, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(message, logId, tenantId)
      .run();
    return { status: "failed", error: message };
  }
}
