import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  isPersonalAdminAuthenticated,
  verifyAdminPassword,
} from "@/lib/personal-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ authenticated: await isPersonalAdminAuthenticated() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string; password?: string };
  const action = body.action || "login";

  if (action === "logout") {
    const cookie = clearAdminSessionCookie();
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": serializeCookie(cookie.name, cookie.value, cookie.options),
      },
    });
  }

  if (!(await verifyAdminPassword(body.password || ""))) {
    return Response.json({ error: "密码不正确" }, { status: 401 });
  }

  const cookie = await createAdminSessionCookie();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": serializeCookie(cookie.name, cookie.value, cookie.options),
    },
  });
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; sameSite: "lax"; path: string; maxAge: number; secure: boolean },
) {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
