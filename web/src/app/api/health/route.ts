import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withApiLogging } from "@/server/observability/apiRoute";
import pkg from "../../../../package.json";

async function GETImpl() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      version: process.env.APP_VERSION ?? pkg.version ?? "unknown",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "db check failed",
        version: process.env.APP_VERSION ?? pkg.version ?? "unknown",
      },
      { status: 503 },
    );
  }
}

export const GET = withApiLogging(GETImpl);
