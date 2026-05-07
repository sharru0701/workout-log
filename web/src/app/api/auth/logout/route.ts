import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  deleteSession,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
