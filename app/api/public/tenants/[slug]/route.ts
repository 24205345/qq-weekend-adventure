import { getPublicTenant } from "@/lib/booking-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return Response.json({ error: "预约页面不存在。" }, { status: 404 });
    return Response.json({ tenant });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "预约页面暂时不可用。" },
      { status: 500 },
    );
  }
}
