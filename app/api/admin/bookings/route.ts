import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { createBooking, getPublicTenant, rescheduleBooking, type CreateBookingInput } from "@/lib/booking-data";
import { createId } from "@/lib/ids";
import { requireMerchant, writeAudit } from "@/lib/merchant";
import { sendMerchantBookingEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const allowedTransitions: Record<string, string[]> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed", "cancelled"],
  completed: [],
  cancelled: ["confirmed"],
  no_show: ["confirmed"],
};

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
    const context = await requireMerchant(user.email);
    if (context.membership.role === "viewer") {
      return Response.json({ error: "只读成员不能创建预约。" }, { status: 403 });
    }
    const tenant = await getPublicTenant(context.tenant.slug);
    if (!tenant) return Response.json({ error: "商户预约配置不可用。" }, { status: 404 });
    const payload = (await request.json()) as CreateBookingInput;
    const booking = await createBooking(tenant, {
      ...payload,
      idempotencyKey: payload.idempotencyKey || `admin-${crypto.randomUUID()}`,
      source: "merchant_admin",
    });
    const notification = await sendMerchantBookingEmail(context.tenant.id, booking.id);
    await writeAudit(context.tenant.id, user.email, "booking.created_manually", "booking", booking.id);
    return Response.json({ booking, notification }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "手工预约创建失败。";
    return Response.json({ error: message }, { status: /容量|时段|选择|填写|最多/.test(message) ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
    const context = await requireMerchant(user.email);
    if (context.membership.role === "viewer") {
      return Response.json({ error: "只读成员不能修改预约。" }, { status: 403 });
    }
    const payload = (await request.json()) as {
      id?: string;
      action?: "status" | "note" | "resend" | "reschedule";
      status?: string;
      internalNote?: string;
      date?: string;
      startTime?: string;
      partySize?: number;
    };
    const id = payload.id?.trim() ?? "";
    const d1 = getD1();
    const booking = await d1
      .prepare(
        `SELECT id, status FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1`,
      )
      .bind(id, context.tenant.id)
      .first<{ id: string; status: string }>();
    if (!booking) return Response.json({ error: "预约不存在。" }, { status: 404 });

    if (payload.action === "note") {
      const note = payload.internalNote?.trim().slice(0, 1000) ?? "";
      await d1
        .prepare(
          `UPDATE bookings SET internal_note = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(note, id, context.tenant.id)
        .run();
      await writeAudit(context.tenant.id, user.email, "booking.note_updated", "booking", id);
      return Response.json({ ok: true });
    }

    if (payload.action === "resend") {
      const notification = await sendMerchantBookingEmail(context.tenant.id, id);
      await writeAudit(context.tenant.id, user.email, "booking.notification_resent", "booking", id, notification);
      return Response.json({ ok: notification.status !== "failed", notification });
    }

    if (payload.action === "reschedule") {
      const tenant = await getPublicTenant(context.tenant.slug);
      if (!tenant) return Response.json({ error: "商户预约配置不可用。" }, { status: 404 });
      const result = await rescheduleBooking(tenant, id, {
        date: payload.date ?? "",
        startTime: payload.startTime ?? "",
        partySize: Number(payload.partySize ?? 1),
      });
      await d1
        .prepare(
          `INSERT INTO booking_events (id, tenant_id, booking_id, event_type, actor_email, detail)
           VALUES (?, ?, ?, 'rescheduled', ?, ?)`,
        )
        .bind(
          createId("event"),
          context.tenant.id,
          id,
          user.email,
          JSON.stringify({
            from: { date: result.current.date, startTime: result.current.start_time, partySize: result.current.party_size },
            to: { date: result.updated.date, startTime: result.updated.start_time, partySize: result.updated.party_size },
          }),
        )
        .run();
      await writeAudit(context.tenant.id, user.email, "booking.rescheduled", "booking", id);
      return Response.json({ ok: true, booking: result.updated });
    }

    if (payload.action === "status") {
      const nextStatus = payload.status?.trim() ?? "";
      if (!(allowedTransitions[booking.status] ?? []).includes(nextStatus)) {
        return Response.json({ error: `预约不能从 ${booking.status} 直接变为 ${nextStatus}。` }, { status: 409 });
      }
      await d1.batch([
        d1
          .prepare(
            `UPDATE bookings SET status = ?, checked_in_at = CASE WHEN ? = 'checked_in' THEN CURRENT_TIMESTAMP ELSE checked_in_at END,
               updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
          )
          .bind(nextStatus, nextStatus, id, context.tenant.id),
        d1
          .prepare(
            `INSERT INTO booking_events (id, tenant_id, booking_id, event_type, actor_email, detail)
             VALUES (?, ?, ?, 'status_changed', ?, ?)`,
          )
          .bind(
            createId("event"),
            context.tenant.id,
            id,
            user.email,
            JSON.stringify({ from: booking.status, to: nextStatus }),
          ),
      ]);
      await writeAudit(context.tenant.id, user.email, "booking.status_changed", "booking", id, {
        from: booking.status,
        to: nextStatus,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "不支持的预约操作。" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "预约更新失败。" },
      { status: 500 },
    );
  }
}
