import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const body = await req.json();

    const userId = body.userId as string;
    const newSlug = body.newSlug as string | undefined;
    const newName = body.newName as string | undefined;

    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const srcT = await db
      .select()
      .from(programTemplate)
      .where(eq(programTemplate.slug, slug))
      .limit(1);

    const sourceTemplate = srcT[0];
    if (!sourceTemplate) return NextResponse.json({ error: "source template not found" }, { status: 404 });

    const srcV = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.templateId, sourceTemplate.id))
      .orderBy(desc(programVersion.version))
      .limit(1);

    const sourceVersion = srcV[0];
    if (!sourceVersion) return NextResponse.json({ error: "source version not found" }, { status: 404 });

    const forkSlug = newSlug ?? `${slug}-${userId}-${Date.now()}`;
    const forkName = newName ?? `${sourceTemplate.name} (Fork)`;

    const created = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(programTemplate)
        .values({
          slug: forkSlug,
          name: forkName,
          type: sourceTemplate.type,
          visibility: "PRIVATE",
          ownerUserId: userId,
          parentTemplateId: sourceTemplate.id, // FK 없이도 OK (uuid 컬럼)
          description: sourceTemplate.description,
          tags: sourceTemplate.tags,
        })
        .returning();

      const [v] = await tx
        .insert(programVersion)
        .values({
          templateId: t.id,
          version: 1,
          parentVersionId: sourceVersion.id, // FK 없이도 OK
          definition: sourceVersion.definition,
          defaults: sourceVersion.defaults,
          changelog: `Forked from ${sourceTemplate.slug}@v${sourceVersion.version}`,
        })
        .returning();

      return { template: t, version: v, source: { template: sourceTemplate, version: sourceVersion } };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
