import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the existing wonderland template as a database-backed booking surface", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /你愿意周末和QQ一起出去玩耍吗/);
  assert.match(page, /\/api\/public\/tenants\/qq-weekend\/bookings/);
  assert.match(page, /idempotencyKey/);
  assert.doesNotMatch(page, /Your site is taking shape|Codex is working|codex-preview/i);
});

test("provides a reusable public booking route", async () => {
  const [page, app] = await Promise.all([
    readFile(new URL("../app/book/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/book/[slug]/PublicBookingApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /PublicBookingApp/);
  assert.match(app, /remainingBookings/);
  assert.match(app, /remainingGuests/);
  assert.match(app, /加入日历/);
  assert.match(app, /确认预约/);
});

test("protects merchant admin surfaces and API routes with server-side identity", async () => {
  const [page, contextRoute, configRoute, bookingRoute] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/context/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/config/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/bookings/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/admin"\)/);
  assert.match(contextRoute, /getChatGPTUser/);
  assert.match(configRoute, /requireMerchant/);
  assert.match(bookingRoute, /requireMerchant/);
});

test("ships the D1 binding and tenant-safe booking migrations", async () => {
  const [hosting, migration] = await Promise.all([
    readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../dist/.openai/drizzle/0000_normal_chat.sql", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(migration, /CREATE TABLE `tenants`/);
  assert.match(migration, /CREATE TABLE `bookings`/);
  assert.match(migration, /`tenant_id` text NOT NULL/);
  assert.match(migration, /bookings_tenant_idempotency_unique/);
  assert.match(migration, /bookings_slot_idx/);
  assert.match(migration, /tenant_qq_weekend/);
});

test("uses atomic capacity checks before inserting a booking", async () => {
  const bookingData = await readFile(new URL("../lib/booking-data.ts", import.meta.url), "utf8");
  assert.match(bookingData, /SELECT COUNT\(\*\) FROM bookings/);
  assert.match(bookingData, /COALESCE\(SUM\(party_size\), 0\)/);
  assert.match(bookingData, /status NOT IN \('cancelled', 'expired'\)/);
  assert.match(bookingData, /这个时段刚刚约满了/);
});
