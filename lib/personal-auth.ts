import { cookies } from "next/headers";
import { getPersonalEnv } from "@/lib/personal-data";

const COOKIE_NAME = "qq_personal_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function getPassword() {
  return getPersonalEnv("PERSONAL_ADMIN_PASSWORD") || "qq-weekend-dev";
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getPassword()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAdminSessionCookie() {
  const expiresAt = String(Date.now() + MAX_AGE_SECONDS * 1000);
  const token = `${expiresAt}.${await sign(expiresAt)}`;
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
      secure: false,
    },
  };
}

export function clearAdminSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      secure: false,
    },
  };
}

export async function verifyAdminPassword(password: string) {
  return password === getPassword();
}

export async function isPersonalAdminAuthenticated() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [expiresAt, signature] = raw.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) < Date.now()) return false;
  const expected = await sign(expiresAt);
  return expected === signature;
}

export async function requirePersonalAdmin() {
  const ok = await isPersonalAdminAuthenticated();
  if (!ok) {
    throw new Error("UNAUTHORIZED");
  }
}
