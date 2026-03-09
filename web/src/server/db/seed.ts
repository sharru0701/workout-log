import "dotenv/config";
import { pathToFileURL } from "node:url";
import { db } from "./client";
import {
  exercise,
  exerciseAlias,
  plan as planTable,
  planModule,
  programTemplate,
  programVersion,
  statsCache,
  userSetting,
  uxEventLog,
  workoutLog,
} from "./schema";
import { and, eq, inArray } from "drizzle-orm";

export type SeedRunOptions = {
  shouldHardReset?: boolean;
  includeDemoPlans?: boolean;
  devUserId?: string;
};

export async function runSeed(options: SeedRunOptions = {}) {
  const legacyProgramSlugs = ["starter-fullbody-3day", "531", "candito-linear"] as const;
  const shouldHardReset = options.shouldHardReset === true;
  const includeDemoPlans = options.includeDemoPlans !== false;

  async function upsertTemplate(slug: string, values: any) {
    const rows = await db
      .insert(programTemplate)
      .values(values)
      .onConflictDoUpdate({
        target: programTemplate.slug,
        set: {
          name: values.name,
          description: values.description ?? null,
          tags: values.tags ?? null,
          type: values.type,
          visibility: values.visibility,
        },
      })
      .returning();
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
      .onConflictDoUpdate({
        target: [programVersion.templateId, programVersion.version],
        set: {
          changelog: values.changelog ?? null,
          definition: values.definition,
          defaults: values.defaults ?? null,
          isDeprecated: values.isDeprecated ?? false,
        },
      })
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
    if (existing[0]) {
      const [updated] = await db
        .update(planTable)
        .set({
          type: values.type ?? existing[0].type,
          rootProgramVersionId: values.rootProgramVersionId ?? existing[0].rootProgramVersionId,
          params: values.params ?? existing[0].params,
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(eq(planTable.id, existing[0].id))
        .returning();
      return updated ?? existing[0];
    }

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

  async function hardResetSeedData() {
    await db.delete(workoutLog);
    await db.delete(planTable);
    await db.delete(programTemplate);
    await db.delete(exercise);
    await db.delete(statsCache);
    await db.delete(userSetting);
    await db.delete(uxEventLog);
    console.log("[seed] hard reset done (workout/program/exercise/stats/settings/ux)");
  }

  async function removeLegacyProgramSeeds() {
    const templates = await db
      .select({
        id: programTemplate.id,
      })
      .from(programTemplate)
      .where(inArray(programTemplate.slug, [...legacyProgramSlugs]));

    if (templates.length < 1) return;

    const templateIds = templates.map((row) => row.id);
    const versions = await db
      .select({
        id: programVersion.id,
      })
      .from(programVersion)
      .where(inArray(programVersion.templateId, templateIds));
    const versionIds = versions.map((row) => row.id);

    if (versionIds.length > 0) {
      const legacyRootPlans = await db
        .select({
          id: planTable.id,
        })
        .from(planTable)
        .where(inArray(planTable.rootProgramVersionId, versionIds));

      const legacyModulePlans = await db
        .select({
          planId: planModule.planId,
        })
        .from(planModule)
        .where(inArray(planModule.programVersionId, versionIds));

      const legacyPlanIds = Array.from(
        new Set([
          ...legacyRootPlans.map((row) => row.id),
          ...legacyModulePlans.map((row) => row.planId),
        ]),
      );

      if (legacyPlanIds.length > 0) {
        await db.delete(workoutLog).where(inArray(workoutLog.planId, legacyPlanIds));
        await db.delete(planTable).where(inArray(planTable.id, legacyPlanIds));
      }

      // Safety: remove module rows that can still reference legacy versions.
      await db.delete(planModule).where(inArray(planModule.programVersionId, versionIds));
    }

    await db.delete(programTemplate).where(inArray(programTemplate.id, templateIds));
    console.log(`[seed] removed legacy templates: ${legacyProgramSlugs.join(", ")}`);
  }

  function repeatSets(
    count: number,
    set: { reps?: number; targetWeightKg?: number; percent?: number; note?: string; rpe?: number },
  ) {
    return Array.from({ length: Math.max(1, count) }, () => ({ ...set }));
  }

  function repeatSetsWithLastNote(
    count: number,
    set: { reps?: number; targetWeightKg?: number; percent?: number; note?: string; rpe?: number },
    lastNote: string,
  ) {
    const rows = repeatSets(count, set);
    rows[rows.length - 1] = {
      ...rows[rows.length - 1],
      note: lastNote,
    };
    return rows;
  }

  if (shouldHardReset) {
    await hardResetSeedData();
  }
  await removeLegacyProgramSeeds();

  // 1) Tactical Barbell Operator (LOGIC)
  const templateOperator = await upsertTemplate("operator", {
    slug: "operator",
    name: "Tactical Barbell Operator (Base)",
    type: "LOGIC",
    visibility: "PUBLIC",
    description:
      "군인·경찰 등 전술 직업군을 위해 설계된 서브맥시멀 근력 프로그램. 실제 1RM의 90%를 트레이닝 맥스(TM)로 설정하고, TM의 70~95% 범위에서 스쿼트·벤치·데드리프트를 6주 웨이브 사이클로 수행한다. 실패 없이 안정적으로 강도를 쌓으며, 6주 완료 시 TM에 소폭 중량을 추가해 장기 점진적 과부하를 유지하는 것이 핵심이다.",
    tags: ["strength", "barbell", "operator", "intermediate"],
  });

  const templateOperatorV1 = await upsertVersion(templateOperator.id, 1, {
    definition: {
      dslVersion: 1,
      kind: "operator",
      schedule: { weeks: 6, sessionsPerWeek: 3 },
      modules: ["SQUAT", "BENCH", "DEADLIFT"],
      progression: {
        profile: "operator-base",
        mainSets: 3,
        deadliftSets: 3,
      },
    },
    defaults: {
      tmPercent: 0.9,
    },
  });

  // 2) Manual template (MANUAL)
  const templateManual = await upsertTemplate("manual", {
    slug: "manual",
    name: "Manual Sessions",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "운동 종목·세트·횟수를 직접 지정해 나만의 루틴을 만드는 완전 자유 구성 템플릿. 자동 진행 로직 없이 매 세션을 수동으로 기록하며, 기존 프로그램에 얽매이지 않고 자신의 훈련 철학대로 커스터마이징하고 싶은 훈련자에게 적합하다.",
    tags: ["manual", "custom"],
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

  const templateStartingStrength = await upsertTemplate("starting-strength-lp", {
    slug: "starting-strength-lp",
    name: "Starting Strength LP (Base)",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "마크 리피토(Mark Rippetoe)가 설계한 초급자용 선형 점진 프로그램. 스쿼트·벤치·데드리프트·오버헤드프레스·파워클린만으로 A/B 루틴을 주 3회 수행하며, 매 세션 2.5~5kg씩 중량을 올린다. 고립 운동을 배제하고 복합 다관절 운동에만 집중해 '노비스 이펙트'를 최대한 활용하도록 설계됐다.",
    tags: ["manual", "strength", "linear", "novice"],
  });

  const templateStartingStrengthV1 = await upsertVersion(templateStartingStrength.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "A",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(3, { reps: 5, targetWeightKg: 80, note: "work set" }),
            },
            {
              exerciseName: "Bench Press",
              sets: repeatSets(3, { reps: 5, targetWeightKg: 60, note: "work set" }),
            },
            {
              exerciseName: "Deadlift",
              sets: [{ reps: 5, targetWeightKg: 100, note: "top set" }],
            },
          ],
        },
        {
          key: "B",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(3, { reps: 5, targetWeightKg: 82.5, note: "work set" }),
            },
            {
              exerciseName: "Overhead Press",
              sets: repeatSets(3, { reps: 5, targetWeightKg: 42.5, note: "work set" }),
            },
            {
              exerciseName: "Power Clean",
              sets: repeatSets(5, { reps: 3, targetWeightKg: 60, note: "work set" }),
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Canonical base A/B split",
  });

  const templateStronglifts = await upsertTemplate("stronglifts-5x5", {
    slug: "stronglifts-5x5",
    name: "StrongLifts 5x5 (Base)",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "Mehdi가 설계한 노비스 선형 점진 프로그램. Starting Strength와 유사하지만 데드리프트를 제외한 모든 주요 운동을 5×5로 수행하는 것이 핵심 차이점이다. 5세트 완성 시마다 2.5kg을 추가하고, 실패 시 명확한 리셋 프로토콜을 따르며, 단순한 규칙 덕분에 입문자가 처음 시작하기에 최적화된 프로그램이다.",
    tags: ["manual", "strength", "linear", "novice", "5x5"],
  });

  const templateStrongliftsV1 = await upsertVersion(templateStronglifts.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "A",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 80, note: "5x5 work set" }),
            },
            {
              exerciseName: "Bench Press",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 57.5, note: "5x5 work set" }),
            },
            {
              exerciseName: "Barbell Row",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 55, note: "5x5 work set" }),
            },
          ],
        },
        {
          key: "B",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 82.5, note: "5x5 work set" }),
            },
            {
              exerciseName: "Overhead Press",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 40, note: "5x5 work set" }),
            },
            {
              exerciseName: "Deadlift",
              sets: [{ reps: 5, targetWeightKg: 105, note: "1x5 top set" }],
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Canonical A/B 5x5 with deadlift 1x5 day",
  });

  const templateTexasMethod = await upsertTemplate("texas-method", {
    slug: "texas-method",
    name: "Texas Method (Base)",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "Starting Strength LP를 졸업한 중급자를 위한 주간 파동 주기화 프로그램. 월요일 볼륨 데이(5×5)→수요일 회복 데이(3×5)→금요일 강도 데이(1×5 PR)로 자극·회복·최대 발현 사이클을 한 주 안에 완성한다. 매주 금요일 PR 세트를 2.5kg씩 올리며, 선형 점진이 한계에 달한 훈련자가 주 단위로 강도 향상을 이어갈 수 있게 해준다.",
    tags: ["manual", "strength", "intermediate", "weekly-undulation"],
  });

  const templateTexasMethodV1 = await upsertVersion(templateTexasMethod.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "V",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 120, note: "volume day" }),
            },
            {
              exerciseName: "Bench Press",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 85, note: "volume day" }),
            },
            {
              exerciseName: "Barbell Row",
              sets: repeatSets(5, { reps: 5, targetWeightKg: 75, note: "volume day" }),
            },
          ],
        },
        {
          key: "R",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(2, { reps: 5, targetWeightKg: 95, note: "recovery day" }),
            },
            {
              exerciseName: "Overhead Press",
              sets: repeatSets(3, { reps: 5, targetWeightKg: 55, note: "recovery day" }),
            },
            {
              exerciseName: "Pull-Up",
              sets: repeatSets(3, { reps: 8, note: "recovery day" }),
            },
          ],
        },
        {
          key: "I",
          items: [
            {
              exerciseName: "Back Squat",
              sets: [{ reps: 5, targetWeightKg: 130, note: "intensity top set" }],
            },
            {
              exerciseName: "Bench Press",
              sets: [{ reps: 5, targetWeightKg: 92.5, note: "intensity top set" }],
            },
            {
              exerciseName: "Deadlift",
              sets: [{ reps: 5, targetWeightKg: 150, note: "intensity top set" }],
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Canonical V/R/I base microcycle",
  });

  const templateGzclp = await upsertTemplate("gzclp", {
    slug: "gzclp",
    name: "GZCLP (Base T1/T2/T3)",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "Cody LeFever가 설계한 3계층(T1/T2/T3) 선형 점진 프로그램. T1(주요 복합 운동, 5×3)은 최대 근력, T2(보조 복합 운동, 3×10)는 근비대, T3(고반복 AMRAP, 3×15+)은 작업 용량을 담당한다. Starting Strength보다 볼륨이 많고 운동 다양성이 높아 근력과 체형을 동시에 발전시키려는 초급~중급자에게 적합하다.",
    tags: ["manual", "strength", "tiers", "top-set", "amrap", "novice"],
  });

  const templateGzclpV1 = await upsertVersion(templateGzclp.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "D1",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSets(5, { reps: 3, targetWeightKg: 100, percent: 0.85, note: "T1 main" }),
            },
            {
              exerciseName: "Bench Press",
              sets: repeatSets(3, { reps: 10, targetWeightKg: 60, percent: 0.7, note: "T2 volume" }),
            },
            {
              exerciseName: "Lat Pulldown",
              sets: repeatSetsWithLastNote(3, { reps: 15, targetWeightKg: 45, note: "T3" }, "T3 AMRAP"),
            },
          ],
        },
        {
          key: "D2",
          items: [
            {
              exerciseName: "Overhead Press",
              sets: repeatSets(5, { reps: 3, targetWeightKg: 52.5, percent: 0.85, note: "T1 main" }),
            },
            {
              exerciseName: "Deadlift",
              sets: repeatSets(3, { reps: 8, targetWeightKg: 110, percent: 0.75, note: "T2 volume" }),
            },
            {
              exerciseName: "Barbell Row",
              sets: repeatSetsWithLastNote(3, { reps: 15, targetWeightKg: 50, note: "T3" }, "T3 AMRAP"),
            },
          ],
        },
        {
          key: "D3",
          items: [
            {
              exerciseName: "Bench Press",
              sets: repeatSets(5, { reps: 3, targetWeightKg: 75, percent: 0.85, note: "T1 main" }),
            },
            {
              exerciseName: "Back Squat",
              sets: repeatSets(3, { reps: 10, targetWeightKg: 90, percent: 0.72, note: "T2 volume" }),
            },
            {
              exerciseName: "Pull-Up",
              sets: repeatSetsWithLastNote(3, { reps: 10, note: "T3" }, "T3 AMRAP"),
            },
          ],
        },
        {
          key: "D4",
          items: [
            {
              exerciseName: "Deadlift",
              sets: repeatSets(5, { reps: 3, targetWeightKg: 140, percent: 0.85, note: "T1 main" }),
            },
            {
              exerciseName: "Overhead Press",
              sets: repeatSets(3, { reps: 10, targetWeightKg: 42.5, percent: 0.72, note: "T2 volume" }),
            },
            {
              exerciseName: "Leg Press",
              sets: repeatSetsWithLastNote(3, { reps: 15, targetWeightKg: 140, note: "T3" }, "T3 AMRAP"),
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Canonical base tier split with T3 AMRAP",
  });

  const templateGreyskull = await upsertTemplate("greyskull-lp", {
    slug: "greyskull-lp",
    name: "Greyskull LP (Base)",
    type: "MANUAL",
    visibility: "PUBLIC",
    description:
      "Starting Strength를 기반으로 '마지막 세트 AMRAP(+ 세트)'를 추가한 초급자 LP. 2×5 후 마지막 세트를 한계까지 수행해 컨디션에 따라 볼륨이 자동 조절되며, 실패 시 리셋이 아닌 10% 감량 후 재시도로 훈련을 이어간다. 플러그인 시스템으로 친업·복근 등 보조 운동을 모듈식으로 추가할 수 있어 체성분 개선을 원하는 초급자에게도 적합하다.",
    tags: ["manual", "strength", "linear", "amrap", "novice"],
  });

  const templateGreyskullV1 = await upsertVersion(templateGreyskull.id, 1, {
    definition: {
      kind: "manual",
      sessions: [
        {
          key: "A",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSetsWithLastNote(3, { reps: 5, targetWeightKg: 90, note: "work set" }, "AMRAP 5+"),
            },
            {
              exerciseName: "Bench Press",
              sets: repeatSetsWithLastNote(3, { reps: 5, targetWeightKg: 62.5, note: "work set" }, "AMRAP 5+"),
            },
            {
              exerciseName: "Barbell Row",
              sets: repeatSetsWithLastNote(3, { reps: 5, targetWeightKg: 57.5, note: "work set" }, "AMRAP 5+"),
            },
          ],
        },
        {
          key: "B",
          items: [
            {
              exerciseName: "Back Squat",
              sets: repeatSetsWithLastNote(3, { reps: 5, targetWeightKg: 92.5, note: "work set" }, "AMRAP 5+"),
            },
            {
              exerciseName: "Overhead Press",
              sets: repeatSetsWithLastNote(3, { reps: 5, targetWeightKg: 42.5, note: "work set" }, "AMRAP 5+"),
            },
            {
              exerciseName: "Deadlift",
              sets: [{ reps: 5, targetWeightKg: 110, note: "AMRAP 5+" }],
            },
          ],
        },
      ],
    },
    defaults: {},
    changelog: "Canonical base A/B 2x5 + 1x5+ structure",
  });

  const seededExercises = [
    { name: "Back Squat", category: "Legs", aliases: ["Squat", "스쿼트"] },
    { name: "Bench Press", category: "Chest", aliases: ["Bench", "벤치프레스"] },
    { name: "Deadlift", category: "Back", aliases: ["DL", "데드리프트"] },
    { name: "Overhead Press", category: "Shoulder", aliases: ["OHP", "Press", "밀리터리 프레스"] },
    { name: "Barbell Row", category: "Back", aliases: ["BB Row", "바벨 로우"] },
    { name: "Pull-Up", category: "Back", aliases: ["풀업", "턱걸이"] },
    { name: "Power Clean", category: "Olympic Lift", aliases: ["Clean", "파워 클린", "파워클린"] },
    { name: "Front Squat", category: "Legs", aliases: ["FSQ", "프론트 스쿼트"] },
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

  const devUserId =
    options.devUserId?.trim() ||
    (process.env.WORKOUT_AUTH_USER_ID ?? "dev").trim() ||
    "dev";

  if (includeDemoPlans) {
    if (templateOperatorV1?.id) {
      await upsertPlanForUser(devUserId, "Program Tactical Barbell Operator", {
        type: "SINGLE",
        rootProgramVersionId: templateOperatorV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["D1", "D2", "D3"],
          sessionKeyMode: "DATE",
          autoProgression: true,
          trainingMaxKg: {
            SQUAT: 150,
            BENCH: 110,
            DEADLIFT: 190,
            PULL: 57.5,
          },
        },
      });
    }

    if (templateStartingStrengthV1?.id) {
      await upsertPlanForUser(devUserId, "Program Starting Strength LP", {
        type: "MANUAL",
        rootProgramVersionId: templateStartingStrengthV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["A", "B"],
          sessionKeyMode: "DATE",
        },
      });
    }

    if (templateStrongliftsV1?.id) {
      await upsertPlanForUser(devUserId, "Program StrongLifts 5x5", {
        type: "MANUAL",
        rootProgramVersionId: templateStrongliftsV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["A", "B"],
          sessionKeyMode: "DATE",
        },
      });
    }

    if (templateTexasMethodV1?.id) {
      await upsertPlanForUser(devUserId, "Program Texas Method", {
        type: "MANUAL",
        rootProgramVersionId: templateTexasMethodV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["V", "R", "I"],
          sessionKeyMode: "DATE",
        },
      });
    }

    if (templateGzclpV1?.id) {
      await upsertPlanForUser(devUserId, "Program GZCLP", {
        type: "MANUAL",
        rootProgramVersionId: templateGzclpV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["D1", "D2", "D3", "D4"],
          sessionKeyMode: "DATE",
        },
      });
    }

    if (templateGreyskullV1?.id) {
      await upsertPlanForUser(devUserId, "Program Greyskull LP", {
        type: "MANUAL",
        rootProgramVersionId: templateGreyskullV1.id,
        params: {
          timezone: "Asia/Seoul",
          startDate: "2026-01-05",
          schedule: ["A", "B"],
          sessionKeyMode: "DATE",
          autoProgression: true,
          trainingMaxKg: {
            SQUAT: 90,
            BENCH: 62.5,
            OHP: 42.5,
            DEADLIFT: 110,
            PULL: 57.5,
          },
        },
      });
    }
  }

  console.log(
    `Seed done. user=${devUserId} includeDemoPlans=${includeDemoPlans ? "1" : "0"} hardReset=${shouldHardReset ? "1" : "0"}`,
  );

  return {
    devUserId,
    includeDemoPlans,
    shouldHardReset,
    baseTemplateCount: 7,
    baseExerciseCount: seededExercises.length,
  };
}

const isDirectExecution =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isDirectExecution) {
  runSeed({
    shouldHardReset: process.env.WORKOUT_SEED_RESET_ALL === "1",
    includeDemoPlans: process.env.WORKOUT_SEED_SKIP_DEMO_PLANS === "1" ? false : true,
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
