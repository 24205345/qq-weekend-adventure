import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    contactEmail: text("contact_email").notNull().default(""),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    primaryColor: text("primary_color").notNull().default("#315f54"),
    accentColor: text("accent_color").notNull().default("#b54b62"),
    template: text("template").notNull().default("gallery"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenants_slug_unique").on(table.slug)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: text("role").notNull().default("staff"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_tenant_email_unique").on(table.tenantId, table.email),
    index("memberships_email_idx").on(table.email),
  ],
);

export const stores = sqliteTable(
  "stores",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    arrivalGuide: text("arrival_guide").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index("stores_tenant_idx").on(table.tenantId)],
);

export const bookingServices = sqliteTable(
  "booking_services",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    storeId: text("store_id").notNull().references(() => stores.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    maxPartySize: integer("max_party_size").notNull().default(6),
    advanceDays: integer("advance_days").notNull().default(60),
    cutoffHours: integer("cutoff_hours").notNull().default(2),
    confirmationMode: text("confirmation_mode").notNull().default("instant"),
    notificationEmail: text("notification_email").notNull().default(""),
    customFields: text("custom_fields").notNull().default("[]"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("services_tenant_slug_unique").on(table.tenantId, table.slug),
    index("services_tenant_store_idx").on(table.tenantId, table.storeId),
  ],
);

export const scheduleRules = sqliteTable(
  "schedule_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    storeId: text("store_id").notNull().references(() => stores.id),
    serviceId: text("service_id").notNull().references(() => bookingServices.id),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("18:00"),
    intervalMinutes: integer("interval_minutes").notNull().default(60),
    slotTimes: text("slot_times").notNull().default("[]"),
    maxBookings: integer("max_bookings").notNull().default(4),
    maxGuests: integer("max_guests").notNull().default(20),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_service_store_weekday_unique").on(
      table.serviceId,
      table.storeId,
      table.weekday,
    ),
    index("schedule_tenant_idx").on(table.tenantId),
  ],
);

export const scheduleExceptions = sqliteTable(
  "schedule_exceptions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    storeId: text("store_id").notNull().references(() => stores.id),
    serviceId: text("service_id").notNull().references(() => bookingServices.id),
    date: text("date").notNull(),
    closed: integer("closed", { mode: "boolean" }).notNull().default(false),
    slotTimes: text("slot_times").notNull().default("[]"),
    maxBookings: integer("max_bookings"),
    maxGuests: integer("max_guests"),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("exception_service_store_date_unique").on(
      table.serviceId,
      table.storeId,
      table.date,
    ),
  ],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    storeId: text("store_id").notNull().references(() => stores.id),
    serviceId: text("service_id").notNull().references(() => bookingServices.id),
    bookingCode: text("booking_code").notNull(),
    manageToken: text("manage_token").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull().default(""),
    customerPhone: text("customer_phone").notNull().default(""),
    partySize: integer("party_size").notNull().default(1),
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: text("status").notNull().default("confirmed"),
    customerNote: text("customer_note").notNull().default(""),
    internalNote: text("internal_note").notNull().default(""),
    customData: text("custom_data").notNull().default("{}"),
    source: text("source").notNull().default("web"),
    checkedInAt: text("checked_in_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bookings_code_unique").on(table.bookingCode),
    uniqueIndex("bookings_manage_token_unique").on(table.manageToken),
    uniqueIndex("bookings_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("bookings_slot_idx").on(
      table.tenantId,
      table.storeId,
      table.serviceId,
      table.date,
      table.startTime,
    ),
    index("bookings_customer_email_idx").on(table.tenantId, table.customerEmail),
  ],
);

export const bookingEvents = sqliteTable(
  "booking_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    eventType: text("event_type").notNull(),
    actorEmail: text("actor_email").notNull().default("system"),
    detail: text("detail").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("booking_events_booking_idx").on(table.bookingId)],
);

export const notificationLogs = sqliteTable(
  "notification_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    eventType: text("event_type").notNull(),
    channel: text("channel").notNull().default("email"),
    recipient: text("recipient").notNull(),
    status: text("status").notNull().default("queued"),
    error: text("error").notNull().default(""),
    attempts: integer("attempts").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("notifications_booking_idx").on(table.bookingId)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_tenant_created_idx").on(table.tenantId, table.createdAt)],
);
