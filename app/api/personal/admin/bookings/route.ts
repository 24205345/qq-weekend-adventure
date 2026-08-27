import { requirePersonalAdmin } from "@/lib/personal-auth";
import { listPersonalBookings, updateBookingStatus } from "@/lib/personal-data";
import { notifyApplicantDecision } from "@/lib/personal-mail";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePersonalAdmin();
    const status = new URL(request.url).searchParams.get("status") || "all";
    const bookings = await listPersonalBookings(status);
    return Response.json({ bookings });
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
      id?: string;
      action?: "approve" | "reject" | "cancel";
      adminNote?: string;
    };

    const action = body.action;
    if (!body.id || !action) throw new Error("缺少预约或操作");

    const status =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    const booking = await updateBookingStatus(body.id, status, body.adminNote || "");

    let applicantMail = { sent: false, skipped: true as boolean, error: undefined as string | undefined };
    if (action === "approve" || action === "reject") {
      applicantMail = await notifyApplicantDecision(booking, action === "approve" ? "approved" : "rejected");
    }

    return Response.json({ booking, applicantMail });
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
