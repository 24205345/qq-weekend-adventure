import { createBooking, getPublicTenant, type CreateBookingInput } from "@/lib/booking-data";
import { sendMerchantBookingEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return Response.json({ error: "预约页面不存在。" }, { status: 404 });
    const payload = (await request.json()) as CreateBookingInput;
    const booking = await createBooking(tenant, payload);
    const notification = booking.duplicate
      ? { status: "skipped", error: "" }
      : await sendMerchantBookingEmail(tenant.id, booking.id);
    return Response.json({ booking, notification }, { status: booking.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "预约提交失败，请稍后重试。";
    const status = /约满|不可预约|请选择|填写|最多|范围/.test(message) ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
