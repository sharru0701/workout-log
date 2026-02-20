import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const templates = await db.select().from(programTemplate);

  // For each template, fetch latest version (v desc limit 1)
  const items = await Promise.all(
    templates.map(async (t) => {
      const v = await db
        .select()
        .from(programVersion)
        .where(eq(programVersion.templateId, t.id))
        .orderBy(desc(programVersion.version))
        .limit(1);

      return { ...t, latestVersion: v[0] ?? null };
    }),
  );

  return NextResponse.json({ items });
}
