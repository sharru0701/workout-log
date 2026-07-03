/**
 * Email verification resend endpoint E2E.
 *
 * - Authenticated unverified user: 200, ok=true
 * - Already-verified user: 200, alreadyVerified=true
 * - Unauthenticated: 401
 *
 * Email send may fail in dev (no Resend key) but the endpoint still
 * responds 200 — sender errors are swallowed and an auth event is logged.
 */
import { eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { db } from "@workout/core/db/client";
import { appUser } from "@workout/core/db/schema";

test.describe("email verification resend", () => {
  test("authenticated unverified user gets ok=true", async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `verify-${suffix}@example.com`;
    await request.post("/api/auth/signup", {
      data: { email, password: "verify-test-pw-123" },
    });

    const res = await request.post("/api/auth/email/verification/request");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyVerified).toBeFalsy();
  });

  test("already-verified user reports alreadyVerified", async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `already-verified-${suffix}@example.com`;
    const signup = await request.post("/api/auth/signup", {
      data: { email, password: "verify-test-pw-123" },
    });
    const userId = (await signup.json()).user.id as string;

    // Mark verified directly via DB
    await db
      .update(appUser)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(appUser.id, userId));

    const res = await request.post("/api/auth/email/verification/request");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyVerified).toBe(true);
  });

  test("/api/auth/me reflects verification status", async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `me-verify-${suffix}@example.com`;
    const signup = await request.post("/api/auth/signup", {
      data: { email, password: "me-verify-pw-123" },
    });
    const userId = (await signup.json()).user.id as string;

    const before = await request.get("/api/auth/me");
    const beforeBody = await before.json();
    expect(beforeBody.user?.emailVerifiedAt).toBeFalsy();

    await db
      .update(appUser)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(appUser.id, userId));

    const after = await request.get("/api/auth/me");
    const afterBody = await after.json();
    expect(afterBody.user?.emailVerifiedAt).toBeTruthy();
  });
});
