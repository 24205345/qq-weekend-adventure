import { getAvailableSlots, getPublicTenant } from "@/lib/booking-data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const storeId = url.searchParams.get("storeId") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const tenant = await getPublicTenant(slug);
    if (!tenant) return Response.json({ error: "预约页面不存在。" }, { status: 404 });
    const slots = await getAvailableSlots(tenant, serviceId, storeId, date);
    return Response.json({ slots });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "时段加载失败。" },
      { status: 500 },
    );
  }
}
