import { createPersonalBooking, deletePersonalBooking } from "@/lib/personal-data";
import { notifyOwnerNewBooking } from "@/lib/personal-mail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      startTime?: string;
      applicantName?: string;
      applicantEmail?: string;
      plan?: string;
      note?: string;
    };

    const booking = await createPersonalBooking({
      date: body.date || "",
      startTime: body.startTime || "",
      applicantName: body.applicantName || "",
      applicantEmail: body.applicantEmail || "",
      plan: body.plan || "",
      note: body.note || "",
    });

    const ownerMail = await notifyOwnerNewBooking({
      bookingId: booking.booking_code,
      applicantName: booking.applicant_name,
      applicantEmail: booking.applicant_email,
      date: booking.date,
      time: booking.start_time,
      plan: booking.plan,
      note: booking.note,
      origin: new URL(request.url).origin,
    });

    if (!ownerMail.sent) {
      await deletePersonalBooking(booking.id);
      return Response.json(
        { error: ownerMail.error || "通知 QQ 失败，请稍后再试。你的选择都还在。" },
        { status: 502 },
      );
    }

    return Response.json({
      booking: {
        id: booking.id,
        code: booking.booking_code,
        status: booking.status,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "提交失败" },
      { status: 400 },
    );
  }
}
