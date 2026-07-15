import { getD1 } from "@/db";
import type { MerchantContext } from "@/lib/merchant";

export async function getAdminSnapshot(context: MerchantContext) {
  const d1 = getD1();
  const tenantId = context.tenant.id;
  const [stores, services, schedules, exceptions, members, bookings, notifications, audit] = await Promise.all([
    d1
      .prepare(
        `SELECT id, name, address, phone, timezone, arrival_guide, active
         FROM stores WHERE tenant_id = ? ORDER BY created_at ASC`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, store_id, slug, name, description, duration_minutes, max_party_size,
                advance_days, cutoff_hours, confirmation_mode, notification_email, custom_fields, active
         FROM booking_services WHERE tenant_id = ? ORDER BY created_at ASC`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, store_id, service_id, weekday, start_time, end_time, interval_minutes,
                slot_times, max_bookings, max_guests, enabled
         FROM schedule_rules WHERE tenant_id = ? ORDER BY service_id, weekday ASC`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, store_id, service_id, date, closed, slot_times, max_bookings, max_guests, note
         FROM schedule_exceptions WHERE tenant_id = ? ORDER BY date ASC LIMIT 100`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, email, display_name, role, status, created_at
         FROM memberships WHERE tenant_id = ? ORDER BY created_at ASC`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT b.id, b.booking_code, b.customer_name, b.customer_email, b.customer_phone,
                b.party_size, b.date, b.start_time, b.end_time, b.status, b.customer_note,
                b.internal_note, b.custom_data, b.source, b.checked_in_at, b.created_at,
                s.name AS service_name, st.name AS store_name
         FROM bookings b
         JOIN booking_services s ON s.id = b.service_id
         JOIN stores st ON st.id = b.store_id
         WHERE b.tenant_id = ?
         ORDER BY b.date DESC, b.start_time DESC, b.created_at DESC
         LIMIT 200`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, booking_id, event_type, channel, recipient, status, error, attempts, created_at
         FROM notification_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(tenantId)
      .all(),
    d1
      .prepare(
        `SELECT id, actor_email, action, target_type, target_id, detail, created_at
         FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(tenantId)
      .all(),
  ]);

  return {
    user: context.membership,
    tenant: context.tenant,
    stores: stores.results,
    services: services.results,
    schedules: schedules.results,
    exceptions: exceptions.results,
    members: members.results,
    bookings: bookings.results,
    notifications: notifications.results,
    audit: audit.results,
  };
}
