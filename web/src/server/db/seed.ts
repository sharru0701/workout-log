import "dotenv/config";
import { db } from "./client";
import { programTemplate, programVersion } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  async function upsertTemplate(slug: string, values: any) {
    const inserted = await db
      .insert(programTemplate)
      .values(values)
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) return inserted[0];
    const rows = await db.select().from(programTemplate).where(eq(programTemplate.slug, slug));
    return rows[0];
  }

  // 1) 5/3/1 (LOGIC)
  const template531 = await upsertTemplate("531", {
    slug: "531",
    name: "5/3/1",
    type: "LOGIC",
    visibility: "PUBLIC",
    description: "Jim Wendler 5/3/1 template (base).",
    tags: ["strength", "barbell"],
  });

  await db
    .insert(programVersion)
    .values({
      templateId: template531.id,
      version: 1,
      definition: {
        kind: "531",
        schedule: { weeks: 4, sessionsPerWeek: 4 },
        mainLifts: ["SQUAT", "BENCH", "DEADLIFT", "OHP"],
      },
      defaults: { tmPercent: 0.9 },
    })
    .onConflictDoNothing();

  // 2) Operator (LOGIC)
  const templateOp = await upsertTemplate("operator", {
    slug: "operator",
    name: "Tactical Barbell Operator",
    type: "LOGIC",
    visibility: "PUBLIC",
    description: "Tactical Barbell Operator template (base).",
    tags: ["strength", "tactical"],
  });

  await db
    .insert(programVersion)
    .values({
      templateId: templateOp.id,
      version: 1,
      definition: {
        kind: "operator",
        schedule: { weeks: 6, sessionsPerWeek: 3 },
        cluster: ["SQUAT", "BENCH", "DEADLIFT"],
      },
      defaults: { intensity: "percent" },
    })
    .onConflictDoNothing();

  // 3) Candito Linear (LOGIC)
  const templateCan = await upsertTemplate("candito-linear", {
    slug: "candito-linear",
    name: "Candito Linear Program",
    type: "LOGIC",
    visibility: "PUBLIC",
    description: "Candito linear program template (base).",
    tags: ["strength", "powerlifting"],
  });

  await db
    .insert(programVersion)
    .values({
      templateId: templateCan.id,
      version: 1,
      definition: { kind: "candito-linear", schedule: { weeks: 6, sessionsPerWeek: 4 } },
      defaults: {},
    })
    .onConflictDoNothing();

  // 4) Manual template (MANUAL)
  const templateManual = await upsertTemplate("manual", {
    slug: "manual",
    name: "Manual Sessions",
    type: "MANUAL",
    visibility: "PUBLIC",
    description: "User-defined fixed sessions (no logic).",
    tags: ["manual"],
  });

  await db
    .insert(programVersion)
    .values({
      templateId: templateManual.id,
      version: 1,
      definition: { kind: "manual", sessions: [] },
      defaults: {},
    })
    .onConflictDoNothing();

  console.log("Seed done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
