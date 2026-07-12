import { env } from "cloudflare:workers";

const FRIDAY_SLOTS = new Set(["21:00", "21:30", "22:00", "22:30", "23:00"]);
const WEEKEND_SLOTS = new Set(["10:30", "13:00", "15:30", "18:00", "20:30"]);
const ACTIVITIES = new Set(["movie", "meal", "exhibition", "drinks", "surprise", "other"]);

type BookingPayload = {
  bookingId?: unknown;
  date?: unknown;
  time?: unknown;
  activity?: unknown;
  activityLabel?: unknown;
  note?: unknown;
  website?: unknown;
};

function shanghaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request) {
  let payload: BookingPayload;

  try {
    payload = (await request.json()) as BookingPayload;
  } catch {
    return Response.json({ ok: false, message: "无效的预约内容" }, { status: 400 });
  }

  if (payload.website) {
    return Response.json({ ok: true });
  }

  const bookingId = typeof payload.bookingId === "string" ? payload.bookingId.slice(0, 40) : "";
  const date = typeof payload.date === "string" ? payload.date : "";
  const time = typeof payload.time === "string" ? payload.time : "";
  const activity = typeof payload.activity === "string" ? payload.activity : "";
  const activityLabel =
    typeof payload.activityLabel === "string" ? payload.activityLabel.trim().slice(0, 80) : "";
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 240) : "";

  if (!/^QQ-\d{8}-\d{4}$/.test(bookingId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, message: "预约编号或日期不正确" }, { status: 400 });
  }

  if (date <= shanghaiToday()) {
    return Response.json({ ok: false, message: "请选择未来的日期" }, { status: 400 });
  }

  const appointmentDate = new Date(`${date}T12:00:00+08:00`);
  const day = appointmentDate.getUTCDay();
  const allowedTime =
    day === 5
      ? FRIDAY_SLOTS.has(time)
      : [0, 6].includes(day) && WEEKEND_SLOTS.has(time);

  if (!allowedTime || !ACTIVITIES.has(activity) || !activityLabel) {
    return Response.json({ ok: false, message: "请选择开放的时段和活动" }, { status: 400 });
  }

  const notifyEmail = (env as unknown as { NOTIFY_EMAIL?: string }).NOTIFY_EMAIL;

  if (!notifyEmail) {
    return Response.json({ ok: false, message: "通知邮箱尚未配置" }, { status: 503 });
  }

  const sourceUrl = request.headers.get("origin") || new URL(request.url).origin;
  const formEndpoint = `https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`;
  const formResponse = await fetch(formEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: sourceUrl,
      Referer: `${sourceUrl}/`,
    },
    body: JSON.stringify({
      _subject: `新的周末约会预约｜${date} ${time}`,
      _template: "table",
      _url: sourceUrl,
      预约编号: bookingId,
      预约日期: date,
      预约时间: time,
      约会计划: activityLabel,
      悄悄话: note || "没有留言",
      提交时间: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    }),
  });

  const formResult = (await formResponse.json().catch(() => null)) as {
    success?: string | boolean;
    message?: string;
  } | null;
  const needsActivation =
    formResponse.ok &&
    String(formResult?.success) === "false" &&
    Boolean(formResult?.message?.toLowerCase().includes("activation"));

  if (!formResponse.ok || (String(formResult?.success) === "false" && !needsActivation)) {
    return Response.json({ ok: false, message: "通知暂时没有送达" }, { status: 502 });
  }

  return Response.json({ ok: true, activationRequired: needsActivation });
}
