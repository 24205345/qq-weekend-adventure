import { getD1 } from "@/db";
import { createBookingCode, createId, createSecretToken } from "@/lib/ids";
import {
  addMinutes,
  isIsoDate,
  isTime,
  isSlotWithinBookingWindow,
  isWithinBookingWindow,
  slotsFromSchedule,
  weekdayFromDate,
} from "@/lib/schedule";

export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  contactEmail: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  template: string;
  stores: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    arrivalGuide: string;
  }>;
  services: Array<{
    id: string;
    storeId: string;
    slug: string;
    name: string;
    description: string;
    durationMinutes: number;
    maxPartySize: number;
    advanceDays: number;
    cutoffHours: number;
    confirmationMode: string;
    notificationEmail: string;
    customFields: string;
  }>;
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  contact_email: string;
  timezone: string;
  primary_color: string;
  accent_color: string;
  template: string;
};

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const d1 = getD1();
  const tenant = await d1
    .prepare(
      `SELECT id, slug, name, contact_email, timezone, primary_color, accent_color, template
       FROM tenants WHERE slug = ? AND status = 'active' LIMIT 1`,
    )
    .bind(slug)
    .first<TenantRow>();
  if (!tenant) return null;

  const [storeResult, serviceResult] = await Promise.all([
    d1
      .prepare(
        `SELECT id, name, address, phone, arrival_guide
         FROM stores WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC`,
      )
      .bind(tenant.id)
      .all<{ id: string; name: string; address: string; phone: string; arrival_guide: string }>(),
    d1
      .prepare(
        `SELECT id, store_id, slug, name, description, duration_minutes, max_party_size,
                advance_days, cutoff_hours, confirmation_mode, notification_email, custom_fields
         FROM booking_services WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC`,
      )
      .bind(tenant.id)
      .all<{
        id: string;
        store_id: string;
        slug: string;
        name: string;
        description: string;
        duration_minutes: number;
        max_party_size: number;
        advance_days: number;
        cutoff_hours: number;
        confirmation_mode: string;
        notification_email: string;
        custom_fields: string;
      }>(),
  ]);

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    contactEmail: tenant.contact_email,
    timezone: tenant.timezone,
    primaryColor: tenant.primary_color,
    accentColor: tenant.accent_color,
    template: tenant.template,
    stores: storeResult.results.map((store) => ({
      id: store.id,
      name: store.name,
      address: store.address,
      phone: store.phone,
      arrivalGuide: store.arrival_guide,
    })),
    services: serviceResult.results.map((service) => ({
      id: service.id,
      storeId: service.store_id,
      slug: service.slug,
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      maxPartySize: service.max_party_size,
      advanceDays: service.advance_days,
      cutoffHours: service.cutoff_hours,
      confirmationMode: service.confirmation_mode,
      notificationEmail: service.notification_email,
      customFields: service.custom_fields,
    })),
  };
}

type AvailabilityRule = {
  start_time: string;
  end_time: string;
  interval_minutes: number;
  slot_times: string;
  max_bookings: number;
  max_guests: number;
  enabled: number;
};

type ServiceRow = {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  duration_minutes: number;
  max_party_size: number;
  advance_days: number;
  cutoff_hours: number;
  confirmation_mode: string;
  notification_email: string;
};

async function getServiceForTenant(tenantId: string, serviceId: string, storeId: string) {
  return getD1()
    .prepare(
      `SELECT id, tenant_id, store_id, name, duration_minutes, max_party_size, advance_days,
              cutoff_hours, confirmation_mode, notification_email
       FROM booking_services
       WHERE id = ? AND tenant_id = ? AND store_id = ? AND active = 1
       LIMIT 1`,
    )
    .bind(serviceId, tenantId, storeId)
    .first<ServiceRow>();
}

async function getRule(tenantId: string, serviceId: string, storeId: string, date: string) {
  const d1 = getD1();
  const exception = await d1
    .prepare(
      `SELECT closed, slot_times, max_bookings, max_guests
       FROM schedule_exceptions
       WHERE tenant_id = ? AND service_id = ? AND store_id = ? AND date = ?
       LIMIT 1`,
    )
    .bind(tenantId, serviceId, storeId, date)
    .first<{ closed: number; slot_times: string; max_bookings: number | null; max_guests: number | null }>();

  const base = await d1
    .prepare(
      `SELECT start_time, end_time, interval_minutes, slot_times, max_bookings, max_guests, enabled
       FROM schedule_rules
       WHERE tenant_id = ? AND service_id = ? AND store_id = ? AND weekday = ?
       LIMIT 1`,
    )
    .bind(tenantId, serviceId, storeId, weekdayFromDate(date))
    .first<AvailabilityRule>();

  if (!base || exception?.closed) return null;
  if (!exception) return base;
  return {
    ...base,
    slot_times: exception.slot_times === "[]" ? base.slot_times : exception.slot_times,
    max_bookings: exception.max_bookings ?? base.max_bookings,
    max_guests: exception.max_guests ?? base.max_guests,
  };
}

export async function getAvailableSlots(
  tenant: PublicTenant,
  serviceId: string,
  storeId: string,
  date: string,
) {
  if (!isIsoDate(date)) return [];
  const service = await getServiceForTenant(tenant.id, serviceId, storeId);
  if (!service || !isWithinBookingWindow(date, service.advance_days, service.cutoff_hours)) return [];
  const rule = await getRule(tenant.id, serviceId, storeId, date);
  if (!rule) return [];

  const occupancy = await getD1()
    .prepare(
      `SELECT start_time, COUNT(*) AS booking_count, COALESCE(SUM(party_size), 0) AS guest_count
       FROM bookings
       WHERE tenant_id = ? AND store_id = ? AND service_id = ? AND date = ?
         AND status NOT IN ('cancelled', 'expired')
       GROUP BY start_time`,
    )
    .bind(tenant.id, storeId, serviceId, date)
    .all<{ start_time: string; booking_count: number; guest_count: number }>();
  const byTime = new Map(occupancy.results.map((row) => [row.start_time, row]));

  return slotsFromSchedule({
    startTime: rule.start_time,
    endTime: rule.end_time,
    intervalMinutes: rule.interval_minutes,
    slotTimes: rule.slot_times,
    maxBookings: rule.max_bookings,
    maxGuests: rule.max_guests,
    enabled: rule.enabled,
  }).filter((time) => isSlotWithinBookingWindow(date, time, service.advance_days, service.cutoff_hours)).map((time) => {
    const used = byTime.get(time);
    const remainingBookings = Math.max(0, rule.max_bookings - Number(used?.booking_count ?? 0));
    const remainingGuests = Math.max(0, rule.max_guests - Number(used?.guest_count ?? 0));
    return {
      time,
      remainingBookings,
      remainingGuests,
      available: remainingBookings > 0 && remainingGuests > 0,
    };
  });
}

export type CreateBookingInput = {
  serviceId: string;
  storeId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  partySize: number;
  customerNote?: string;
  customData?: Record<string, unknown>;
  idempotencyKey: string;
  source?: string;
};

export async function createBooking(tenant: PublicTenant, input: CreateBookingInput) {
  const d1 = getD1();
  const customerName = input.customerName.trim();
  const customerEmail = input.customerEmail?.trim().toLowerCase() ?? "";
  const customerPhone = input.customerPhone?.trim() ?? "";
  if (!customerName || customerName.length > 80) throw new Error("请填写有效的预约人姓名。");
  if (!isIsoDate(input.date) || !isTime(input.startTime)) throw new Error("请选择有效的预约时间。");
  if (!input.idempotencyKey || input.idempotencyKey.length > 100) throw new Error("预约请求无效，请刷新后重试。");

  const existing = await d1
    .prepare(
      `SELECT id, booking_code, manage_token, status, date, start_time, end_time
       FROM bookings WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1`,
    )
    .bind(tenant.id, input.idempotencyKey)
    .first<{
      id: string;
      booking_code: string;
      manage_token: string;
      status: string;
      date: string;
      start_time: string;
      end_time: string;
    }>();
  if (existing) return mapCreatedBooking(existing, true);

  const service = await getServiceForTenant(tenant.id, input.serviceId, input.storeId);
  if (!service) throw new Error("预约主题不存在或已经下架。");
  const partySize = Math.floor(Number(input.partySize));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > service.max_party_size) {
    throw new Error(`本主题每次最多预约 ${service.max_party_size} 人。`);
  }
  if (!isWithinBookingWindow(input.date, service.advance_days, service.cutoff_hours)) {
    throw new Error("该日期不在可预约范围内。");
  }
  if (!isSlotWithinBookingWindow(input.date, input.startTime, service.advance_days, service.cutoff_hours)) {
    throw new Error("该时段已经超过预约截止时间。");
  }

  const rule = await getRule(tenant.id, input.serviceId, input.storeId, input.date);
  if (!rule || !slotsFromSchedule({
    startTime: rule.start_time,
    endTime: rule.end_time,
    intervalMinutes: rule.interval_minutes,
    slotTimes: rule.slot_times,
    maxBookings: rule.max_bookings,
    maxGuests: rule.max_guests,
    enabled: rule.enabled,
  }).includes(input.startTime)) {
    throw new Error("该时段当前不可预约。");
  }

  const id = createId("booking");
  const bookingCode = createBookingCode();
  const manageToken = createSecretToken();
  const endTime = addMinutes(input.startTime, service.duration_minutes);
  const status = service.confirmation_mode === "manual" ? "pending_confirmation" : "confirmed";
  const customData = JSON.stringify(input.customData ?? {});

  const inserted = await d1
    .prepare(
      `INSERT INTO bookings
        (id, tenant_id, store_id, service_id, booking_code, manage_token, idempotency_key,
         customer_name, customer_email, customer_phone, party_size, date, start_time, end_time,
         status, customer_note, custom_data, source)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE
         (SELECT COUNT(*) FROM bookings
          WHERE tenant_id = ? AND store_id = ? AND service_id = ? AND date = ? AND start_time = ?
            AND status NOT IN ('cancelled', 'expired')) < ?
         AND
         (SELECT COALESCE(SUM(party_size), 0) FROM bookings
          WHERE tenant_id = ? AND store_id = ? AND service_id = ? AND date = ? AND start_time = ?
            AND status NOT IN ('cancelled', 'expired')) + ? <= ?
       RETURNING id, booking_code, manage_token, status, date, start_time, end_time`,
    )
    .bind(
      id,
      tenant.id,
      input.storeId,
      input.serviceId,
      bookingCode,
      manageToken,
      input.idempotencyKey,
      customerName,
      customerEmail,
      customerPhone,
      partySize,
      input.date,
      input.startTime,
      endTime,
      status,
      input.customerNote?.trim().slice(0, 500) ?? "",
      customData,
      input.source ?? "web",
      tenant.id,
      input.storeId,
      input.serviceId,
      input.date,
      input.startTime,
      rule.max_bookings,
      tenant.id,
      input.storeId,
      input.serviceId,
      input.date,
      input.startTime,
      partySize,
      rule.max_guests,
    )
    .first<{
      id: string;
      booking_code: string;
      manage_token: string;
      status: string;
      date: string;
      start_time: string;
      end_time: string;
    }>();

  if (!inserted) throw new Error("这个时段刚刚约满了，请选择其他时间。");

  await d1.batch([
    d1
      .prepare(
        `INSERT INTO booking_events (id, tenant_id, booking_id, event_type, actor_email, detail)
         VALUES (?, ?, ?, 'created', 'public', ?)`,
      )
      .bind(createId("event"), tenant.id, id, JSON.stringify({ source: input.source ?? "web" })),
    d1
      .prepare(
        `INSERT INTO notification_logs
          (id, tenant_id, booking_id, event_type, channel, recipient, status, attempts)
         VALUES (?, ?, ?, 'booking_created', 'email', ?, 'queued', 0)`,
      )
      .bind(createId("notification"), tenant.id, id, service.notification_email || tenant.contactEmail),
  ]);

  return mapCreatedBooking(inserted, false);
}

export async function rescheduleBooking(
  tenant: PublicTenant,
  bookingId: string,
  input: { date: string; startTime: string; partySize: number },
) {
  const d1 = getD1();
  const current = await d1
    .prepare(
      `SELECT id, service_id, store_id, date, start_time, party_size, status
       FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1`,
    )
    .bind(bookingId, tenant.id)
    .first<{
      id: string;
      service_id: string;
      store_id: string;
      date: string;
      start_time: string;
      party_size: number;
      status: string;
    }>();
  if (!current) throw new Error("预约不存在。");
  if (["completed", "expired"].includes(current.status)) throw new Error("已完成或已过期的预约不能改期。");
  if (!isIsoDate(input.date) || !isTime(input.startTime)) throw new Error("请选择有效的改期时间。");

  const service = await getServiceForTenant(tenant.id, current.service_id, current.store_id);
  if (!service) throw new Error("预约主题已经下架，无法改期。");
  const partySize = Math.floor(Number(input.partySize));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > service.max_party_size) {
    throw new Error(`本主题每次最多预约 ${service.max_party_size} 人。`);
  }
  if (!isSlotWithinBookingWindow(input.date, input.startTime, service.advance_days, 0)) {
    throw new Error("目标时段不在可预约范围内。");
  }
  const rule = await getRule(tenant.id, current.service_id, current.store_id, input.date);
  if (!rule || !slotsFromSchedule({
    startTime: rule.start_time,
    endTime: rule.end_time,
    intervalMinutes: rule.interval_minutes,
    slotTimes: rule.slot_times,
    maxBookings: rule.max_bookings,
    maxGuests: rule.max_guests,
    enabled: rule.enabled,
  }).includes(input.startTime)) {
    throw new Error("目标时段当前不可预约。");
  }

  const endTime = addMinutes(input.startTime, service.duration_minutes);
  const updated = await d1
    .prepare(
      `UPDATE bookings
       SET date = ?, start_time = ?, end_time = ?, party_size = ?,
           status = CASE WHEN status IN ('cancelled', 'no_show') THEN 'confirmed' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?
         AND (SELECT COUNT(*) FROM bookings
              WHERE tenant_id = ? AND store_id = ? AND service_id = ? AND date = ? AND start_time = ?
                AND id <> ? AND status NOT IN ('cancelled', 'expired')) < ?
         AND (SELECT COALESCE(SUM(party_size), 0) FROM bookings
              WHERE tenant_id = ? AND store_id = ? AND service_id = ? AND date = ? AND start_time = ?
                AND id <> ? AND status NOT IN ('cancelled', 'expired')) + ? <= ?
       RETURNING id, date, start_time, end_time, party_size, status`,
    )
    .bind(
      input.date,
      input.startTime,
      endTime,
      partySize,
      bookingId,
      tenant.id,
      tenant.id,
      current.store_id,
      current.service_id,
      input.date,
      input.startTime,
      bookingId,
      rule.max_bookings,
      tenant.id,
      current.store_id,
      current.service_id,
      input.date,
      input.startTime,
      bookingId,
      partySize,
      rule.max_guests,
    )
    .first<{ id: string; date: string; start_time: string; end_time: string; party_size: number; status: string }>();
  if (!updated) throw new Error("目标时段容量不足，请选择其他时间。");
  return { current, updated };
}

function mapCreatedBooking(
  row: {
    id: string;
    booking_code: string;
    manage_token: string;
    status: string;
    date: string;
    start_time: string;
    end_time: string;
  },
  duplicate: boolean,
) {
  return {
    id: row.id,
    code: row.booking_code,
    manageToken: row.manage_token,
    status: row.status,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duplicate,
  };
}
