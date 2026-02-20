import "dotenv/config";
import { db } from "./client";
import { programTemplate, programVersion } from "./schema";

async function main() {
  // 1) 5/3/1 (LOGIC)
  const [t531] = await db
    .insert(programTemplate)
    .values({
      slug: "531",
      name: "5/3/1",
      type: "LOGIC",
      visibility: "PUBLIC",
      description: "Jim Wendler 5/3/1 template (base).",
      tags: ["strength", "barbell"],
    })
    .onConflictDoNothing()
    .returning();

  // if already exists, fetch id
  const template531 =
    t531 ??
    (await db.select().from(programTemplate).where(programTemplate.slug.eq("531")))[0];

  // Minimal DSL example (placeholder - we'll define properly next)
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
  const [tOp] = await db
    .insert(programTemplate)
    .values({
      slug: "operator",
      name: "Tactical Barbell Operator",
      type: "LOGIC",
      visibility: "PUBLIC",
      description: "Tactical Barbell Operator template (base).",
      tags: ["strength", "tactical"],
    })
    .onConflictDoNothing()
    .returning();

  const templateOp =
    tOp ??
    (await db.select().from(programTemplate).where(programTemplate.slug.eq("operator")))[0];

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
  const [tCan] = await db
    .insert(programTemplate)
    .values({
      slug: "candito-linear",
      name: "Candito Linear Program",
      type: "LOGIC",
      visibility: "PUBLIC",
      description: "Candito linear program template (base).",
      tags: ["strength", "powerlifting"],
    })
    .onConflictDoNothing()
    .returning();

  const templateCan =
    tCan ??
    (await db.select().from(programTemplate).where(programTemplate.slug.eq("candito-linear")))[0];

  await db
    .insert(programVersion)
    .values({
      templateId: templateCan.id,
      version: 1,
      definition: {
        kind: "candito-linear",
        schedule: { weeks: 6, sessionsPerWeek: 4 },
      },
      defaults: {},
    })
    .onConflictDoNothing();

  // 4) Manual template (MANUAL)
  const [tManual] = await db
    .insert(programTemplate)
    .values({
      slug: "manual",
      name: "Manual Sessions",
      type: "MANUAL",
      visibility: "PUBLIC",
      description: "User-defined fixed sessions (no logic).",
      tags: ["manual"],
    })
    .onConflictDoNothing()
    .returning();

  const templateManual =
    tManual ??
    (await db.select().from(programTemplate).where(programTemplate.slug.eq("manual")))[0];

  await db
    .insert(programVersion)
    .values({
      templateId: templateManual.id,
      version: 1,
      definition: {
        kind: "manual",
        sessions: [],
      },
      defaults: {},
    })
    .onConflictDoNothing();

  console.log("Seed done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
