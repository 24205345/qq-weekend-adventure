import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import { createId } from "@/lib/ids";
import { createPersonalBookingId } from "@/lib/personal-booking";
import {
  getBaseSlotsForDate,
  isEmail,
  isIsoDate,
  isTime,
  type PersonalBookingStatus,
} from "@/lib/personal-schedule";

export type PersonalBookingRow = {
  id: string;
  booking_code: string;
  applicant_name: string;
  applicant_email: string;
  date: string;
  start_time: string;
  plan: string;
  note: string;
  status: PersonalBookingStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export type PersonalBlockRow = {
  id: string;
  date: string;
  start_time: string;
  reason: string;
  created_at: string;
};

let schemaReady: Promise<void> | null = null;

export async function ensurePersonalSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const d1 = getD1();
      await d1.batch([
        d1.prepare(`CREATE TABLE IF NOT EXISTS personal_bookings (
          id text PRIMARY KEY NOT NULL,
          booking_code text NOT NULL,
          applicant_name text NOT NULL,
          applicant_email text NOT NULL,
          date text NOT NULL,
          start_time text NOT NULL,
          plan text NOT NULL,
          note text DEFAULT '' NOT NULL,
          status text DEFAULT 'pending' NOT NULL,
          admin_note text DEFAULT '' NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`),
        d1.prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS personal_bookings_code_unique ON personal_bookings (booking_code)`,
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS personal_bookings_slot_idx ON personal_bookings (date, start_time)`,
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS personal_bookings_status_idx ON personal_bookings (status)`,
        ),
        d1.prepare(`CREATE TABLE IF NOT EXISTS personal_slot_blocks (
          id text PRIMARY KEY NOT NULL,
          date text NOT NULL,
          start_time text NOT NULL,
          reason text DEFAULT '' NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`),
        d1.prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS personal_slot_blocks_unique ON personal_slot_blocks (date, start_time)`,
        ),
      ]);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function occupyingStatuses() {
  return `('pending', 'approved')`;
}

export async function listSlotsForDate(date: string) {
  await ensurePersonalSchema();
  if (!isIsoDate(date)) throw new Error("日期格式不正确");

  const base = getBaseSlotsForDate(date);
  if (base.length === 0) {
    return { date, slots: [] as Array<{ time: string; available: boolean; reason?: string }> };
  }

  const d1 = getD1();
  const [booked, blocked] = await Promise.all([
    d1
      .prepare(
        `SELECT start_time, status FROM personal_bookings
         WHERE date = ? AND status IN ${occupyingStatuses()}`,
      )
      .bind(date)
      .all<{ start_time: string; status: string }>(),
    d1
      .prepare(`SELECT start_time, reason FROM personal_slot_blocks WHERE date = ?`)
      .bind(date)
      .all<{ start_time: string; reason: string }>(),
  ]);

  const bookedMap = new Map((booked.results ?? []).map((row) => [row.start_time, row.status]));
  const blockMap = new Map((blocked.results ?? []).map((row) => [row.start_time, row.reason]));

  return {
    date,
    slots: base.map((time) => {
      if (blockMap.has(time)) {
        return { time, available: false, reason: blockMap.get(time) || "已关闭" };
      }
      if (bookedMap.has(time)) {
        const status = bookedMap.get(time);
        return {
          time,
          available: false,
          reason: status === "approved" ? "已确认约会" : "待 QQ 确认",
        };
      }
      return { time, available: true };
    }),
  };
}

export async function createPersonalBooking(input: {
  date: string;
  startTime: string;
  applicantName: string;
  applicantEmail: string;
  plan: string;
  note: string;
}) {
  await ensurePersonalSchema();

  const name = input.applicantName.trim();
  const email = input.applicantEmail.trim().toLowerCase();
  const plan = input.plan.trim();
  const note = input.note.trim();

  if (!isIsoDate(input.date)) throw new Error("日期格式不正确");
  if (!isTime(input.startTime)) throw new Error("时间格式不正确");
  if (!name || name.length > 24) throw new Error("请填写有效的名字或昵称");
  if (!isEmail(email)) throw new Error("请填写有效的邮箱，方便 QQ 回复你");
  if (!plan || plan.length > 80) throw new Error("请选择或填写约会计划");
  if (note.length > 240) throw new Error("悄悄话有点长了");

  const base = getBaseSlotsForDate(input.date);
  if (!base.includes(input.startTime)) throw new Error("这个时段不在可约范围内");

  const availability = await listSlotsForDate(input.date);
  const slot = availability.slots.find((item) => item.time === input.startTime);
  if (!slot?.available) throw new Error(slot?.reason || "这个时段刚刚被约走了");

  const id = createId("pbook");
  const bookingCode = createPersonalBookingId(new Date(`${input.date}T12:00:00`));
  const d1 = getD1();

  try {
    await d1
      .prepare(
        `INSERT INTO personal_bookings
          (id, booking_code, applicant_name, applicant_email, date, start_time, plan, note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, bookingCode, name, email, input.date, input.startTime, plan, note)
      .run();
  } catch {
    throw new Error("这个时段刚刚被约走了，请换一个时间");
  }

  const row = await getBookingById(id);
  if (!row) throw new Error("预约写入失败");
  return row;
}

export async function getBookingById(id: string) {
  await ensurePersonalSchema();
  return getD1()
    .prepare(`SELECT * FROM personal_bookings WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<PersonalBookingRow>();
}

export async function listPersonalBookings(status?: string) {
  await ensurePersonalSchema();
  const d1 = getD1();
  if (status && status !== "all") {
    return (
      (
        await d1
          .prepare(
            `SELECT * FROM personal_bookings WHERE status = ? ORDER BY date ASC, start_time ASC, created_at DESC`,
          )
          .bind(status)
          .all<PersonalBookingRow>()
      ).results ?? []
    );
  }
  return (
    (
      await d1
        .prepare(`SELECT * FROM personal_bookings ORDER BY date ASC, start_time ASC, created_at DESC`)
        .all<PersonalBookingRow>()
    ).results ?? []
  );
}

export async function listBlocks(date?: string) {
  await ensurePersonalSchema();
  const d1 = getD1();
  if (date) {
    if (!isIsoDate(date)) throw new Error("日期格式不正确");
    return (
      (
        await d1
          .prepare(
            `SELECT * FROM personal_slot_blocks WHERE date = ? ORDER BY start_time ASC`,
          )
          .bind(date)
          .all<PersonalBlockRow>()
      ).results ?? []
    );
  }
  return (
    (
      await d1
        .prepare(`SELECT * FROM personal_slot_blocks ORDER BY date ASC, start_time ASC`)
        .all<PersonalBlockRow>()
    ).results ?? []
  );
}

export async function blockSlot(date: string, startTime: string, reason = "手动关闭") {
  await ensurePersonalSchema();
  if (!isIsoDate(date) || !isTime(startTime)) throw new Error("日期或时间不正确");
  const d1 = getD1();
  const existing = await d1
    .prepare(`SELECT id FROM personal_slot_blocks WHERE date = ? AND start_time = ? LIMIT 1`)
    .bind(date, startTime)
    .first<{ id: string }>();

  if (existing) {
    await d1
      .prepare(`UPDATE personal_slot_blocks SET reason = ? WHERE id = ?`)
      .bind(reason.slice(0, 80), existing.id)
      .run();
    return;
  }

  await d1
    .prepare(
      `INSERT INTO personal_slot_blocks (id, date, start_time, reason)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(createId("pblock"), date, startTime, reason.slice(0, 80))
    .run();
}

export async function unblockSlot(date: string, startTime: string) {
  await ensurePersonalSchema();
  if (!isIsoDate(date) || !isTime(startTime)) throw new Error("日期或时间不正确");
  await getD1()
    .prepare(`DELETE FROM personal_slot_blocks WHERE date = ? AND start_time = ?`)
    .bind(date, startTime)
    .run();
}

export async function deletePersonalBooking(id: string) {
  await ensurePersonalSchema();
  await getD1().prepare(`DELETE FROM personal_bookings WHERE id = ?`).bind(id).run();
}

export async function updateBookingStatus(
  id: string,
  status: Extract<PersonalBookingStatus, "approved" | "rejected" | "cancelled">,
  adminNote = "",
) {
  await ensurePersonalSchema();
  const current = await getBookingById(id);
  if (!current) throw new Error("找不到这笔预约");
  if (current.status === status) return current;

  const d1 = getD1();
  await d1
    .prepare(
      `UPDATE personal_bookings
       SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, adminNote.slice(0, 240), id)
    .run();

  if (status === "approved") {
    await blockSlot(current.date, current.start_time, `已同意 ${current.booking_code}`);
  }

  if (status === "rejected" || status === "cancelled") {
    // 仅当该时段没有其他占用预约时，不自动删手动封禁；同意产生的封禁可保留，避免立刻被别人约走。
    // 若管理员要重新开放，可在档期里手动「重新开放」。
  }

  const next = await getBookingById(id);
  if (!next) throw new Error("更新预约失败");
  return next;
}

export function getPersonalEnv(name: string) {
  const value = (env as Record<string, string | undefined>)[name];
  return typeof value === "string" ? value : "";
}
