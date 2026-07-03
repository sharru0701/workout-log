import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@workout/core/db/client";
import { appUser } from "@workout/core/db/schema";
import { consumeEmailVerificationToken } from "@workout/core/auth/email-verification";
import { logAuthEvent } from "@workout/core/auth/security-events";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const redirect = new URL("/", url.origin);

  if (!token) {
    redirect.searchParams.set("emailVerified", "invalid");
    return NextResponse.redirect(redirect);
  }

  const consumed = await consumeEmailVerificationToken(token);
  if (!consumed) {
    await logAuthEvent({
      eventType: "EMAIL_VERIFICATION_CONFIRM",
      req,
      success: false,
    }).catch(() => {});
    redirect.searchParams.set("emailVerified", "invalid");
    return NextResponse.redirect(redirect);
  }

  const verifiedAt = new Date();
  await db
    .update(appUser)
    .set({ emailVerifiedAt: verifiedAt })
    .where(eq(appUser.id, consumed.userId));

  await logAuthEvent({
    userId: consumed.userId,
    eventType: "EMAIL_VERIFICATION_CONFIRM",
    req,
    success: true,
  }).catch(() => {});

  redirect.searchParams.set("emailVerified", "1");
  return NextResponse.redirect(redirect);
}
