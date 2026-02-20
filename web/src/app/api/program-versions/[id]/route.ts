import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programVersion } from "@/server/db/schema";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const definition = body.definition;
    if (!definition) {
      return NextResponse.json({ error: "definition required" }, { status: 400 });
    }

    const [updated] = await db
      .update(programVersion)
      .set({ definition })
      .where(eq(programVersion.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ programVersion: updated });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
