import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise, exerciseAlias } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") ?? "").trim();
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 20;

    let baseRows: Array<{ id: string; name: string; category: string | null }> = [];

    if (query) {
      const nameRows = await db
        .select({ id: exercise.id, name: exercise.name, category: exercise.category })
        .from(exercise)
        .where(sql`lower(${exercise.name}) like lower(${`%${query}%`})`)
        .limit(limit);

      const aliasRows = await db
        .select({ id: exercise.id, name: exercise.name, category: exercise.category })
        .from(exerciseAlias)
        .innerJoin(exercise, eq(exerciseAlias.exerciseId, exercise.id))
        .where(sql`lower(${exerciseAlias.alias}) like lower(${`%${query}%`})`)
        .limit(limit);

      const map = new Map<string, { id: string; name: string; category: string | null }>();
      for (const r of nameRows) map.set(r.id, r);
      for (const r of aliasRows) map.set(r.id, r);
      baseRows = Array.from(map.values()).slice(0, limit);
    } else {
      baseRows = await db
        .select({ id: exercise.id, name: exercise.name, category: exercise.category })
        .from(exercise)
        .orderBy(exercise.name)
        .limit(limit);
    }

    if (baseRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const ids = baseRows.map((r) => r.id);
    const aliases = await db
      .select({ exerciseId: exerciseAlias.exerciseId, alias: exerciseAlias.alias })
      .from(exerciseAlias)
      .where(inArray(exerciseAlias.exerciseId, ids));

    const aliasMap = new Map<string, string[]>();
    for (const a of aliases) {
      const list = aliasMap.get(a.exerciseId) ?? [];
      list.push(a.alias);
      aliasMap.set(a.exerciseId, list);
    }

    const items = baseRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      aliases: aliasMap.get(r.id) ?? [],
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

async function POSTImpl(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const category = body.category ? String(body.category).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const inserted = await db
      .insert(exercise)
      .values({ name, category })
      .onConflictDoNothing()
      .returning({
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
      });

    if (inserted[0]) {
      return NextResponse.json({ exercise: inserted[0], created: true }, { status: 201 });
    }

    const existing = await db
      .select({ id: exercise.id, name: exercise.name, category: exercise.category })
      .from(exercise)
      .where(eq(exercise.name, name))
      .limit(1);

    return NextResponse.json({ exercise: existing[0] ?? null, created: false });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);

export const POST = withApiLogging(POSTImpl);
