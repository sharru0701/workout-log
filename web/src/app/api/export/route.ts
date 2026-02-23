import { NextResponse } from "next/server";
import { buildUserDataExport, buildWorkoutSetCsv } from "@/server/export/userExport";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const format = (searchParams.get("format") ?? "json").toLowerCase();
    const type = (searchParams.get("type") ?? "").toLowerCase();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "csv") {
      if (type !== "workout_set") {
        return NextResponse.json(
          { error: "CSV export requires type=workout_set" },
          { status: 400 },
        );
      }

      const csv = await buildWorkoutSetCsv(userId);
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="workout-log-${userId}-workout_set-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    if (format !== "json") {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 400 });
    }

    const data = await buildUserDataExport(userId);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="workout-log-${userId}-export-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
