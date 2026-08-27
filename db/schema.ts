import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const personalBookings = sqliteTable(
  "personal_bookings",
  {
    id: text("id").primaryKey(),
    bookingCode: text("booking_code").notNull(),
    applicantName: text("applicant_name").notNull(),
    applicantEmail: text("applicant_email").notNull(),
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    plan: text("plan").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("pending"),
    adminNote: text("admin_note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("personal_bookings_code_unique").on(table.bookingCode),
    index("personal_bookings_slot_idx").on(table.date, table.startTime),
    index("personal_bookings_status_idx").on(table.status),
  ],
);

export const personalSlotBlocks = sqliteTable(
  "personal_slot_blocks",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("personal_slot_blocks_unique").on(table.date, table.startTime)],
);
