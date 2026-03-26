import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

async function GETImpl() {
  try {
    const rows = await db
      .selectDistinct({ category: exercise.category })
      .from(exercise)
      .where(isNotNull(exercise.category))
      .orderBy(exercise.category);

    const categories = rows.map((r) => r.category as string);
    return NextResponse.json({ categories });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
