import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the wonderland personal invite wired to personal APIs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const personal = await readFile(new URL("../lib/personal-booking.ts", import.meta.url), "utf8");
  assert.match(page, /你愿意周末和QQ一起出去玩耍吗/);
  assert.match(page, /\/api\/personal\/bookings/);
  assert.match(page, /applicantEmail/);
  assert.match(personal, /formsubmit\.co\/ajax/);
  assert.doesNotMatch(page, /\/api\/public\/tenants\//);
  assert.doesNotMatch(page, /Your site is taking shape|Codex is working|codex-preview/i);
});

test("provides a personal light admin for approvals and slot blocks", async () => {
  const [adminPage, adminApp, data] = await Promise.all([
    readFile(new URL("../app/my-admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/my-admin/PersonalAdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/personal-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(adminPage, /PersonalAdminApp/);
  assert.match(adminApp, /同意并通知/);
  assert.match(adminApp, /拒绝并通知/);
  assert.match(data, /personal_bookings/);
  assert.match(data, /personal_slot_blocks/);
});

test("does not ship multi-merchant routes in the personal app", async () => {
  const checks = await Promise.allSettled([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/book/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/booking-data.ts", import.meta.url), "utf8"),
  ]);
  for (const result of checks) {
    assert.notEqual(result.status, "fulfilled", "SaaS files should be removed from personal project");
  }
});
