import "dotenv/config";
import { db } from "./client";
import { exercise, exerciseAlias, plan as planTable, programTemplate, programVersion } from "./schema";
import { and, eq } from "drizzle-orm";

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

  async function upsertVersion(templateId: string, version: number, values: any) {
    const inserted = await db
      .insert(programVersion)
      .values({
        templateId,
        version,
        ...values,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) return inserted[0];
    const rows = await db
      .select()
      .from(programVersion)
      .where(and(eq(programVersion.templateId, templateId), eq(programVersion.version, version)))
      .limit(1);
    return rows[0];
  }

  async function upsertExercise(input: {
    name: string;
    category: string | null;
    aliases?: string[];
  }) {
    const inserted = await db
      .insert(exercise)
      .values({
        name: input.name,
        category: input.category,
      })
      .onConflictDoNothing()
      .returning();

    const item =
      inserted[0] ??
      (
        await db
          .select()
          .from(exercise)
          .where(eq(exercise.name, input.name))
          .limit(1)
      )[0];

    if (!item) return null;

    for (const alias of input.aliases ?? []) {
      const normalizedAlias = alias.trim();
      if (!normalizedAlias) continue;
      await db
        .insert(exerciseAlias)
        .values({
          exerciseId: item.id,
          alias: normalizedAlias,
        })
        .onConflictDoNothing();
    }

    return item;
  }

  async function upsertPlanForUser(userId: string, name: string, values: any) {
    const existing = await db
      .select()
      .from(planTable)
      .where(and(eq(planTable.userId, userId), eq(planTable.name, name)))
      .limit(1);
    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(planTable)
      .values({
        userId,
        name,
        ...values,
      })
      .returning();
    return inserted[0];
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

  const template531v1 = await upsertVersion(template531.id, 1, {
    definition: {
      dslVersion: 1,
      kind: "531",
      schedule: { weeks: 4, sessionsPerWeek: 4 },
      lifts: ["SQUAT", "BENCH", "DEADLIFT", "OHP"],
      progression: { cycle: "531-basic" },
    },
    defaults: { tmPercent: 0.9 },
  });

  // 2) Operator (LOGIC)
  const templateOp = await upsertTemplate("operator", {
    slug: "operator",
    name: "Tactical Barbell Operator",
    type: "LOGIC",
    visibility: "PUBLIC",
    description: "Tactical Barbell Operator template (base).",
    tags: ["strength", "tactical"],
  });

  await upsertVersion(templateOp.id, 1, {
    definition: {
      dslVersion: 1,
      kind: "operator",
      schedule: { weeks: 6, sessionsPerWeek: 3 },
      modules: ["SQUAT", "BENCH", "DEADLIFT"],
      progression: { profile: "operator-simplified" },
    },
    defaults: { intensity: "percent" },
  });

  // 3) Candito Linear (LOGIC)
  const templateCan = await upsertTemplate("candito-linear", {
    slug: "candito-linear",
    name: "Candito Linear Program",
    type: "LOGIC",
    visibility: "PUBLIC",
    description: "Candito linear program template (base).",
    tags: ["strength", "powerlifting"],
  });

  await upsertVersion(templateCan.id, 1, {
    definition: {
      dslVersion: 1,
      kind: "candito-linear",
      schedule: { weeks: 6, sessionsPerWeek: 4 },
      lifts: ["SQUAT", "BENCH", "DEADLIFT"],
      progression: { profile: "candito-linear-simplified" },
    },
    defaults: {},
  });

  // 4) Manual template (MANUAL)
  const templateManual = await upsertTemplate("manual", {
    slug: "manual",
    name: "Manual Sessions",
    type: "MANUAL",
    visibility: "PUBLIC",
    description: "User-defined fixed sessions (no logic).",
    tags: ["manual"],
  });

  await upsertVersion(templateManual.id, 1, {
    definition: { kind: "manual", sessions: [] },
    defaults: {},
  });

  await upsertVersion(templateManual.id, 2, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "A",
          items: [
            {
              exerciseName: "Back Squat",
              sets: [
                { reps: 5, targetWeightKg: 80 },
                { reps: 5, targetWeightKg: 80 },
                { reps: 5, targetWeightKg: 80 },
              ],
            },
            {
              exerciseName: "Bench Press",
              sets: [
                { reps: 5, targetWeightKg: 60 },
                { reps: 5, targetWeightKg: 60 },
                { reps: 5, targetWeightKg: 60 },
              ],
            },
          ],
        },
        {
          key: "B",
          items: [
            {
              exerciseName: "Deadlift",
              sets: [
                { reps: 5, targetWeightKg: 100 },
                { reps: 5, targetWeightKg: 100 },
              ],
            },
            {
              exerciseName: "Overhead Press",
              sets: [
                { reps: 6, targetWeightKg: 40 },
                { reps: 6, targetWeightKg: 40 },
                { reps: 6, targetWeightKg: 40 },
              ],
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Local demo manual sessions",
  });

  const templateStarter = await upsertTemplate("starter-fullbody-3day", {
    slug: "starter-fullbody-3day",
    name: "Starter Fullbody 3 Day",
    type: "MANUAL",
    visibility: "PUBLIC",
    description: "로컬 테스트용 3일 풀바디 예시 프로그램",
    tags: ["manual", "starter", "fullbody"],
  });

  const templateStarterV1 = await upsertVersion(templateStarter.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "A",
          items: [
            { exerciseName: "Back Squat", sets: [{ reps: 8, targetWeightKg: 60 }, { reps: 8, targetWeightKg: 60 }] },
            { exerciseName: "Bench Press", sets: [{ reps: 8, targetWeightKg: 45 }, { reps: 8, targetWeightKg: 45 }] },
            { exerciseName: "Barbell Row", sets: [{ reps: 10, targetWeightKg: 40 }, { reps: 10, targetWeightKg: 40 }] },
          ],
        },
        {
          key: "B",
          items: [
            { exerciseName: "Deadlift", sets: [{ reps: 5, targetWeightKg: 80 }, { reps: 5, targetWeightKg: 80 }] },
            { exerciseName: "Overhead Press", sets: [{ reps: 8, targetWeightKg: 32.5 }, { reps: 8, targetWeightKg: 32.5 }] },
            { exerciseName: "Pull-Up", sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] },
          ],
        },
        {
          key: "C",
          items: [
            { exerciseName: "Leg Press", sets: [{ reps: 12, targetWeightKg: 120 }, { reps: 12, targetWeightKg: 120 }] },
            { exerciseName: "Incline Bench Press", sets: [{ reps: 10, targetWeightKg: 40 }, { reps: 10, targetWeightKg: 40 }] },
            { exerciseName: "Lat Pulldown", sets: [{ reps: 12, targetWeightKg: 45 }, { reps: 12, targetWeightKg: 45 }] },
          ],
        },
      ],
    },
    defaults: {},
  });

  const seededExercises = [
    { name: "Back Squat", category: "Legs", aliases: ["Squat", "스쿼트"] },
    { name: "Bench Press", category: "Chest", aliases: ["Bench", "벤치프레스"] },
    { name: "Deadlift", category: "Back", aliases: ["DL", "데드리프트"] },
    { name: "Overhead Press", category: "Shoulder", aliases: ["OHP", "밀리터리 프레스"] },
    { name: "Barbell Row", category: "Back", aliases: ["BB Row", "바벨 로우"] },
    { name: "Pull-Up", category: "Back", aliases: ["풀업", "턱걸이"] },
    { name: "Incline Bench Press", category: "Chest", aliases: ["인클라인 벤치"] },
    { name: "Romanian Deadlift", category: "Legs", aliases: ["RDL", "루마니안 데드리프트"] },
    { name: "Leg Press", category: "Legs", aliases: ["레그 프레스"] },
    { name: "Lat Pulldown", category: "Back", aliases: ["랫풀다운", "Lat Pull"] },
    { name: "Dumbbell Shoulder Press", category: "Shoulder", aliases: ["덤벨 숄더 프레스", "DB Shoulder Press"] },
    { name: "Hip Thrust", category: "Glute", aliases: ["힙 쓰러스트"] },
  ];
  for (const item of seededExercises) {
    await upsertExercise(item);
  }

  const devUserId = (process.env.WORKOUT_AUTH_USER_ID ?? "dev").trim() || "dev";
  if (template531v1?.id) {
    await upsertPlanForUser(devUserId, "Demo 5/3/1", {
      type: "SINGLE",
      rootProgramVersionId: template531v1.id,
      params: {
        timezone: "Asia/Seoul",
        trainingMaxKg: {
          SQUAT: 140,
          BENCH: 100,
          DEADLIFT: 180,
          OHP: 70,
        },
      },
    });
  }
  if (templateStarterV1?.id) {
    await upsertPlanForUser(devUserId, "Demo Starter Fullbody", {
      type: "MANUAL",
      rootProgramVersionId: templateStarterV1.id,
      params: {
        timezone: "Asia/Seoul",
        startDate: "2025-01-01",
        schedule: ["A", "B", "C"],
        sessionKeyMode: "LEGACY",
      },
    });
  }

  console.log(`Seed done. user=${devUserId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
