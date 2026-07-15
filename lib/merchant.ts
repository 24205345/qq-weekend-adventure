import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { createId, slugify } from "@/lib/ids";

export type MerchantContext = {
  membership: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    role: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    contactEmail: string;
    timezone: string;
    primaryColor: string;
    accentColor: string;
    template: string;
    status: string;
  };
};

type MembershipRow = {
  membership_id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: string;
  slug: string;
  tenant_name: string;
  contact_email: string;
  timezone: string;
  primary_color: string;
  accent_color: string;
  template: string;
  tenant_status: string;
};

function mapContext(row: MembershipRow): MerchantContext {
  return {
    membership: {
      id: row.membership_id,
      tenantId: row.tenant_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    },
    tenant: {
      id: row.tenant_id,
      slug: row.slug,
      name: row.tenant_name,
      contactEmail: row.contact_email,
      timezone: row.timezone,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
      template: row.template,
      status: row.tenant_status,
    },
  };
}

export async function getMerchantContext(email: string) {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT
        m.id AS membership_id,
        m.tenant_id,
        m.email,
        m.display_name,
        m.role,
        t.slug,
        t.name AS tenant_name,
        t.contact_email,
        t.timezone,
        t.primary_color,
        t.accent_color,
        t.template,
        t.status AS tenant_status
      FROM memberships m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE lower(m.email) = lower(?) AND m.status = 'active' AND t.status = 'active'
      ORDER BY m.created_at ASC
      LIMIT 1`,
    )
    .bind(email.trim())
    .first<MembershipRow>();

  return row ? mapContext(row) : null;
}

export async function ensureMerchantForUser(user: ChatGPTUser) {
  const existing = await getMerchantContext(user.email);
  if (existing) return existing;

  const d1 = getD1();
  const tenantId = createId("tenant");
  const storeId = createId("store");
  const serviceId = createId("service");
  const membershipId = createId("member");
  const baseSlug = slugify(user.email.split("@")[0]);
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  const merchantName = user.fullName ? `${user.fullName}的预约空间` : "我的预约空间";

  const statements = [
    d1
      .prepare(
        `INSERT INTO tenants
          (id, slug, name, contact_email, timezone, primary_color, accent_color, template, status)
         VALUES (?, ?, ?, ?, 'Asia/Shanghai', '#315f54', '#b54b62', 'gallery', 'active')`,
      )
      .bind(tenantId, slug, merchantName, user.email),
    d1
      .prepare(
        `INSERT INTO memberships
          (id, tenant_id, email, display_name, role, status)
         VALUES (?, ?, ?, ?, 'owner', 'active')`,
      )
      .bind(membershipId, tenantId, user.email.toLowerCase(), user.displayName),
    d1
      .prepare(
        `INSERT INTO stores
          (id, tenant_id, name, address, phone, timezone, arrival_guide, active)
         VALUES (?, ?, '主门店', '', '', 'Asia/Shanghai', '', 1)`,
      )
      .bind(storeId, tenantId),
    d1
      .prepare(
        `INSERT INTO booking_services
          (id, tenant_id, store_id, slug, name, description, duration_minutes, max_party_size,
           advance_days, cutoff_hours, confirmation_mode, notification_email, custom_fields, active)
         VALUES (?, ?, ?, 'visit', '到店体验', '选择合适的时间，完成一次轻松的到店预约。', 90, 6,
           60, 2, 'instant', ?, '[]', 1)`,
      )
      .bind(serviceId, tenantId, storeId, user.email),
  ];

  for (const weekday of [2, 3, 4, 5, 6, 0]) {
    statements.push(
      d1
        .prepare(
          `INSERT INTO schedule_rules
            (id, tenant_id, store_id, service_id, weekday, start_time, end_time, interval_minutes,
             slot_times, max_bookings, max_guests, enabled)
           VALUES (?, ?, ?, ?, ?, '10:00', '18:00', 60, '[]', 4, 20, 1)`,
        )
        .bind(createId("schedule"), tenantId, storeId, serviceId, weekday),
    );
  }

  await d1.batch(statements);
  const created = await getMerchantContext(user.email);
  if (!created) throw new Error("商户初始化失败，请稍后重试。");
  return created;
}

export async function requireMerchant(email: string) {
  const context = await getMerchantContext(email);
  if (!context) throw new Error("你还没有可访问的商户。");
  return context;
}

export function canManage(role: string) {
  return role === "owner" || role === "admin";
}

export async function writeAudit(
  tenantId: string,
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
) {
  await getD1()
    .prepare(
      `INSERT INTO audit_logs (id, tenant_id, actor_email, action, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(createId("audit"), tenantId, actorEmail, action, targetType, targetId, JSON.stringify(detail))
    .run();
}
