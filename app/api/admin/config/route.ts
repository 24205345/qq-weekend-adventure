import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { createId, slugify } from "@/lib/ids";
import { canManage, requireMerchant, writeAudit } from "@/lib/merchant";
import { isIsoDate, isTime } from "@/lib/schedule";

export const dynamic = "force-dynamic";

type Command =
  | { action: "updateTenant"; name?: string; contactEmail?: string; primaryColor?: string; accentColor?: string; template?: string }
  | { action: "createStore"; name?: string; address?: string; phone?: string; arrivalGuide?: string }
  | { action: "updateStore"; id?: string; name?: string; address?: string; phone?: string; arrivalGuide?: string; active?: boolean }
  | {
      action: "createService";
      storeId?: string;
      name?: string;
      description?: string;
      durationMinutes?: number;
      maxPartySize?: number;
      advanceDays?: number;
      cutoffHours?: number;
      confirmationMode?: string;
      notificationEmail?: string;
    }
  | {
      action: "updateService";
      id?: string;
      storeId?: string;
      name?: string;
      description?: string;
      durationMinutes?: number;
      maxPartySize?: number;
      advanceDays?: number;
      cutoffHours?: number;
      confirmationMode?: string;
      notificationEmail?: string;
      active?: boolean;
    }
  | {
      action: "upsertSchedule";
      serviceId?: string;
      storeId?: string;
      weekday?: number;
      startTime?: string;
      endTime?: string;
      intervalMinutes?: number;
      slotTimes?: string[];
      maxBookings?: number;
      maxGuests?: number;
      enabled?: boolean;
    }
  | {
      action: "upsertException";
      serviceId?: string;
      storeId?: string;
      date?: string;
      closed?: boolean;
      slotTimes?: string[];
      maxBookings?: number | null;
      maxGuests?: number | null;
      note?: string;
    }
  | { action: "inviteMember"; email?: string; displayName?: string; role?: string }
  | { action: "updateMember"; id?: string; role?: string; status?: string };

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

async function ownsStore(tenantId: string, storeId: string) {
  return Boolean(
    await getD1()
      .prepare("SELECT 1 AS ok FROM stores WHERE id = ? AND tenant_id = ? LIMIT 1")
      .bind(storeId, tenantId)
      .first(),
  );
}

async function ownsService(tenantId: string, serviceId: string, storeId?: string) {
  const sql = storeId
    ? "SELECT 1 AS ok FROM booking_services WHERE id = ? AND tenant_id = ? AND store_id = ? LIMIT 1"
    : "SELECT 1 AS ok FROM booking_services WHERE id = ? AND tenant_id = ? LIMIT 1";
  const statement = getD1().prepare(sql);
  return Boolean(
    storeId
      ? await statement.bind(serviceId, tenantId, storeId).first()
      : await statement.bind(serviceId, tenantId).first(),
  );
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
    const context = await requireMerchant(user.email);
    if (!canManage(context.membership.role)) {
      return Response.json({ error: "当前角色没有配置权限。" }, { status: 403 });
    }
    const command = (await request.json()) as Command;
    const d1 = getD1();
    const tenantId = context.tenant.id;

    if (command.action === "updateTenant") {
      const name = text(command.name, 80);
      const contactEmail = text(command.contactEmail, 160).toLowerCase();
      const primaryColor = text(command.primaryColor, 7);
      const accentColor = text(command.accentColor, 7);
      const template = ["gallery", "wonderland", "restaurant"].includes(text(command.template, 20))
        ? text(command.template, 20)
        : "gallery";
      if (!name || !validEmail(contactEmail) || !validColor(primaryColor) || !validColor(accentColor)) {
        return Response.json({ error: "请检查商户名称、通知邮箱和品牌颜色。" }, { status: 400 });
      }
      await d1
        .prepare(
          `UPDATE tenants SET name = ?, contact_email = ?, primary_color = ?, accent_color = ?,
             template = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(name, contactEmail, primaryColor, accentColor, template, tenantId)
        .run();
      await writeAudit(tenantId, user.email, "tenant.updated", "tenant", tenantId);
      return Response.json({ ok: true });
    }

    if (command.action === "createStore") {
      const name = text(command.name, 80);
      if (!name) return Response.json({ error: "请填写门店名称。" }, { status: 400 });
      const id = createId("store");
      await d1
        .prepare(
          `INSERT INTO stores (id, tenant_id, name, address, phone, timezone, arrival_guide, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        )
        .bind(
          id,
          tenantId,
          name,
          text(command.address, 240),
          text(command.phone, 40),
          context.tenant.timezone,
          text(command.arrivalGuide, 500),
        )
        .run();
      await writeAudit(tenantId, user.email, "store.created", "store", id);
      return Response.json({ ok: true, id }, { status: 201 });
    }

    if (command.action === "updateStore") {
      const id = text(command.id, 80);
      const name = text(command.name, 80);
      if (!id || !name || !(await ownsStore(tenantId, id))) {
        return Response.json({ error: "门店不存在或名称无效。" }, { status: 400 });
      }
      await d1
        .prepare(
          `UPDATE stores SET name = ?, address = ?, phone = ?, arrival_guide = ?, active = ?,
             updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
        )
        .bind(
          name,
          text(command.address, 240),
          text(command.phone, 40),
          text(command.arrivalGuide, 500),
          command.active === false ? 0 : 1,
          id,
          tenantId,
        )
        .run();
      await writeAudit(tenantId, user.email, "store.updated", "store", id);
      return Response.json({ ok: true });
    }

    if (command.action === "createService") {
      const storeId = text(command.storeId, 80);
      const name = text(command.name, 100);
      if (!name || !storeId || !(await ownsStore(tenantId, storeId))) {
        return Response.json({ error: "请选择有效门店并填写主题名称。" }, { status: 400 });
      }
      const id = createId("service");
      const baseSlug = slugify(name);
      const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 5)}`;
      const notificationEmail = text(command.notificationEmail, 160).toLowerCase();
      if (notificationEmail && !validEmail(notificationEmail)) {
        return Response.json({ error: "通知邮箱格式不正确。" }, { status: 400 });
      }
      await d1
        .prepare(
          `INSERT INTO booking_services
            (id, tenant_id, store_id, slug, name, description, duration_minutes, max_party_size,
             advance_days, cutoff_hours, confirmation_mode, notification_email, custom_fields, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1)`,
        )
        .bind(
          id,
          tenantId,
          storeId,
          slug,
          name,
          text(command.description, 1000),
          integer(command.durationMinutes, 15, 1440, 90),
          integer(command.maxPartySize, 1, 500, 6),
          integer(command.advanceDays, 1, 365, 60),
          integer(command.cutoffHours, 0, 720, 2),
          command.confirmationMode === "manual" ? "manual" : "instant",
          notificationEmail || context.tenant.contactEmail,
        )
        .run();
      await writeAudit(tenantId, user.email, "service.created", "service", id);
      return Response.json({ ok: true, id }, { status: 201 });
    }

    if (command.action === "updateService") {
      const id = text(command.id, 80);
      const storeId = text(command.storeId, 80);
      const name = text(command.name, 100);
      const notificationEmail = text(command.notificationEmail, 160).toLowerCase();
      if (
        !id ||
        !name ||
        !storeId ||
        !(await ownsStore(tenantId, storeId)) ||
        !(await ownsService(tenantId, id)) ||
        (notificationEmail && !validEmail(notificationEmail))
      ) {
        return Response.json({ error: "预约主题信息无效。" }, { status: 400 });
      }
      await d1
        .prepare(
          `UPDATE booking_services SET store_id = ?, name = ?, description = ?, duration_minutes = ?,
             max_party_size = ?, advance_days = ?, cutoff_hours = ?, confirmation_mode = ?,
             notification_email = ?, active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(
          storeId,
          name,
          text(command.description, 1000),
          integer(command.durationMinutes, 15, 1440, 90),
          integer(command.maxPartySize, 1, 500, 6),
          integer(command.advanceDays, 1, 365, 60),
          integer(command.cutoffHours, 0, 720, 2),
          command.confirmationMode === "manual" ? "manual" : "instant",
          notificationEmail || context.tenant.contactEmail,
          command.active === false ? 0 : 1,
          id,
          tenantId,
        )
        .run();
      await writeAudit(tenantId, user.email, "service.updated", "service", id);
      return Response.json({ ok: true });
    }

    if (command.action === "upsertSchedule") {
      const serviceId = text(command.serviceId, 80);
      const storeId = text(command.storeId, 80);
      const weekday = integer(command.weekday, 0, 6, -1);
      const startTime = text(command.startTime, 5);
      const endTime = text(command.endTime, 5);
      const slotTimes = Array.isArray(command.slotTimes)
        ? [...new Set(command.slotTimes.map((slot) => text(slot, 5)).filter(isTime))].sort()
        : [];
      if (
        weekday < 0 ||
        !isTime(startTime) ||
        !isTime(endTime) ||
        !(await ownsService(tenantId, serviceId, storeId))
      ) {
        return Response.json({ error: "开放时间配置无效。" }, { status: 400 });
      }
      const id = createId("schedule");
      await d1
        .prepare(
          `INSERT INTO schedule_rules
            (id, tenant_id, store_id, service_id, weekday, start_time, end_time, interval_minutes,
             slot_times, max_bookings, max_guests, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(service_id, store_id, weekday) DO UPDATE SET
             start_time = excluded.start_time,
             end_time = excluded.end_time,
             interval_minutes = excluded.interval_minutes,
             slot_times = excluded.slot_times,
             max_bookings = excluded.max_bookings,
             max_guests = excluded.max_guests,
             enabled = excluded.enabled,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          id,
          tenantId,
          storeId,
          serviceId,
          weekday,
          startTime,
          endTime,
          integer(command.intervalMinutes, 5, 720, 60),
          JSON.stringify(slotTimes),
          integer(command.maxBookings, 1, 1000, 4),
          integer(command.maxGuests, 1, 10000, 20),
          command.enabled === false ? 0 : 1,
        )
        .run();
      await writeAudit(tenantId, user.email, "schedule.updated", "service", serviceId, { weekday });
      return Response.json({ ok: true });
    }

    if (command.action === "upsertException") {
      const serviceId = text(command.serviceId, 80);
      const storeId = text(command.storeId, 80);
      const date = text(command.date, 10);
      const slotTimes = Array.isArray(command.slotTimes)
        ? [...new Set(command.slotTimes.map((slot) => text(slot, 5)).filter(isTime))].sort()
        : [];
      if (!isIsoDate(date) || !(await ownsService(tenantId, serviceId, storeId))) {
        return Response.json({ error: "日期例外配置无效。" }, { status: 400 });
      }
      const id = createId("exception");
      await d1
        .prepare(
          `INSERT INTO schedule_exceptions
            (id, tenant_id, store_id, service_id, date, closed, slot_times, max_bookings, max_guests, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(service_id, store_id, date) DO UPDATE SET
             closed = excluded.closed,
             slot_times = excluded.slot_times,
             max_bookings = excluded.max_bookings,
             max_guests = excluded.max_guests,
             note = excluded.note,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          id,
          tenantId,
          storeId,
          serviceId,
          date,
          command.closed ? 1 : 0,
          JSON.stringify(slotTimes),
          command.maxBookings == null ? null : integer(command.maxBookings, 1, 1000, 4),
          command.maxGuests == null ? null : integer(command.maxGuests, 1, 10000, 20),
          text(command.note, 300),
        )
        .run();
      await writeAudit(tenantId, user.email, "exception.updated", "service", serviceId, { date });
      return Response.json({ ok: true });
    }

    if (command.action === "inviteMember") {
      const email = text(command.email, 160).toLowerCase();
      const role = ["admin", "receptionist", "staff", "viewer"].includes(text(command.role, 20))
        ? text(command.role, 20)
        : "staff";
      if (!validEmail(email)) return Response.json({ error: "成员邮箱格式不正确。" }, { status: 400 });
      const id = createId("member");
      await d1
        .prepare(
          `INSERT INTO memberships (id, tenant_id, email, display_name, role, status)
           VALUES (?, ?, ?, ?, ?, 'active')
           ON CONFLICT(tenant_id, email) DO UPDATE SET
             display_name = excluded.display_name, role = excluded.role, status = 'active',
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(id, tenantId, email, text(command.displayName, 80), role)
        .run();
      await writeAudit(tenantId, user.email, "member.invited", "member", id, { email, role });
      return Response.json({ ok: true });
    }

    if (command.action === "updateMember") {
      const id = text(command.id, 80);
      const role = ["admin", "receptionist", "staff", "viewer"].includes(text(command.role, 20))
        ? text(command.role, 20)
        : "staff";
      const status = command.status === "inactive" ? "inactive" : "active";
      const member = await d1
        .prepare("SELECT role, email FROM memberships WHERE id = ? AND tenant_id = ? LIMIT 1")
        .bind(id, tenantId)
        .first<{ role: string; email: string }>();
      if (!member || member.role === "owner") {
        return Response.json({ error: "所有者成员不能在这里修改。" }, { status: 400 });
      }
      await d1
        .prepare(
          `UPDATE memberships SET role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(role, status, id, tenantId)
        .run();
      await writeAudit(tenantId, user.email, "member.updated", "member", id, { role, status });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "不支持的配置操作。" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "配置保存失败。" },
      { status: 500 },
    );
  }
}
