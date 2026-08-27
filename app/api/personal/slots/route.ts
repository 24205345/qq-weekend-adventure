import { listSlotsForDate } from "@/lib/personal-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date") || "";
    const payload = await listSlotsForDate(date);
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "无法读取时段" },
      { status: 400 },
    );
  }
}
