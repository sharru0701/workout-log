/**
 * Password setup E2E (PR #264 follow-up).
 *
 * Validates that POST /api/auth/password/setup behaves correctly:
 * - rejects when account already has a password (signup path)
 * - rejects short passwords
 * - accepts valid input on accounts without a password (only verifiable
 *   via the rejection path here, since signup-created users always have
 *   a password; the success path is exercised in the manual smoke list)
 */
import { expect, test } from "@playwright/test";

test.describe("password setup", () => {
  test("returns 409 when account already has a password (post-signup)", async ({
    request,
  }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `setup-existing-${suffix}@example.com`;

    await request.post("/api/auth/signup", {
      data: { email, password: "existing-password-123" },
    });

    const res = await request.post("/api/auth/password/setup", {
      data: { newPassword: "new-password-456" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PASSWORD_ALREADY_SET");
  });

  test("rejects passwords shorter than 8 characters", async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `setup-short-${suffix}@example.com`;

    await request.post("/api/auth/signup", {
      data: { email, password: "long-enough-pw-123" },
    });

    const res = await request.post("/api/auth/password/setup", {
      data: { newPassword: "short" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invalid request body", async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `setup-bad-${suffix}@example.com`;

    await request.post("/api/auth/signup", {
      data: { email, password: "long-enough-pw-123" },
    });

    const res = await request.post("/api/auth/password/setup", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
