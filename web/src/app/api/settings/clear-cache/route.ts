import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";

async function POSTImpl() {
  const userId = getAuthenticatedUserId();
  await invalidateStatsCacheForUser(userId);
  return NextResponse.json({ ok: true });
}

export const POST = withApiLogging(POSTImpl);
