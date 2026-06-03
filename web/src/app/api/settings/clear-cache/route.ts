import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";

async function POSTImpl() {
  const userId = await requireAuthenticatedUserId();
  await invalidateStatsCacheForUser(userId);
  return NextResponse.json({ ok: true });
}

export const POST = withApiLogging(POSTImpl);
