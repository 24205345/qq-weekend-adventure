import { requirePersonalAdmin } from "@/lib/personal-auth";
import { blockSlot, listBlocks, listSlotsForDate, unblockSlot } from "@/lib/personal-data";
import { getBaseSlotsForDate } from "@/lib/personal-schedule";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePersonalAdmin();
    const date = new URL(request.url).searchParams.get("date") || "";
    if (date) {
      const [slots, blocks] = await Promise.all([listSlotsForDate(date), listBlocks(date)]);
      return Response.json({
        date,
        baseSlots: getBaseSlotsForDate(date),
        slots: slots.slots,
        blocks,
      });
    }
    return Response.json({ blocks: await listBlocks() });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requirePersonalAdmin();
    const body = (await request.json()) as {
      action?: "block" | "unblock";
      date?: string;
      startTime?: string;
      reason?: string;
    };

    if (!body.date || !body.startTime) throw new Error("请选择日期和时间");
    if (body.action === "unblock") {
      await unblockSlot(body.date, body.startTime);
    } else {
      await blockSlot(body.date, body.startTime, body.reason || "手动关闭");
    }

    return Response.json({ ok: true, ...(await listSlotsForDate(body.date)) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "操作失败" },
      { status: 400 },
    );
  }
}
