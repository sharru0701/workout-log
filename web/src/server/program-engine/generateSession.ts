import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  generatedSession,
  plan as planTable,
  planModule,
  planOverride,
  programTemplate,
  programVersion,
} from "@/server/db/schema";

type AccessoryPatch = {
  op: "ADD_ACCESSORY";
  value: {
    exerciseName: string;
    sets: Array<{ setNumber?: number; reps?: number; weightKg?: number; rpe?: number }>;
    order?: number;
  };
};

type ReplaceExercisePatch = {
  op: "REPLACE_EXERCISE";
  target: { blockTarget: string };
  value: { exerciseName: string };
};

type ReorderBlocksPatch = {
  op: "REORDER_BLOCKS";
  value: { order: string[] };
};

type Patch = AccessoryPatch | ReplaceExercisePatch | ReorderBlocksPatch;

/**
 * DSL v1 contract (minimal):
 * {
 *   dslVersion?: 1,
 *   kind: "531" | "operator" | "candito-linear",
 *   schedule: { weeks: number, sessionsPerWeek: number },
 *   lifts?: string[],          // generic targets
 *   modules?: string[],        // generic targets
 *   progression?: object       // template-specific parameters
 * }
 */
type LogicDefinitionV1 = {
  dslVersion?: number;
  kind: string;
  schedule?: { weeks?: number; sessionsPerWeek?: number };
  lifts?: string[];
  modules?: string[];
  mainLifts?: string[]; // legacy support
  cluster?: string[]; // legacy support
  progression?: Record<string, any>;
};

type PlannedSet = {
  reps?: number;
  targetWeightKg?: number;
  percent?: number;
  rpe?: number;
  note?: string;
};

type PlannedExercise = {
  exerciseId?: string | null;
  exerciseName: string;
  role: "MAIN" | "ASSIST";
  sets: PlannedSet[];
  sourceBlockTarget?: string;
  order?: number;
};

type GeneratorCtx = {
  week: number;
  day: number;
  params: any;
  defaults: any;
  forcedTarget?: string;
  orderBase: number;
};

type SessionContext = {
  week: number;
  day: number;
  sessionDate: string;
  sessionKey: string;
  timezone: string;
};

function toNumberOrNull(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTarget(v: string) {
  return String(v).trim().toUpperCase();
}

function defaultExerciseNameForTarget(target: string) {
  const t = normalizeTarget(target);
  if (t === "SQUAT") return "Back Squat";
  if (t === "BENCH") return "Bench Press";
  if (t === "DEADLIFT") return "Deadlift";
  if (t === "OHP") return "Overhead Press";
  if (t === "PULL") return "Pull-Up";
  return "Main Lift";
}

function roundToNearest2p5(v: number) {
  return Math.round(v / 2.5) * 2.5;
}

function toDateOnlyInTimezone(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function isDateOnlyString(v: string | null | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

function dateOnlyToUtcMs(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map((x) => Number(x));
  return Date.UTC(y, m - 1, d);
}

function clampPositiveInt(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function deriveSessionContext(input: {
  plan: any;
  week?: number;
  day?: number;
  sessionDate?: string;
  timezone?: string;
}) {
  const params = (input.plan?.params ?? {}) as any;
  const timezone =
    (typeof input.timezone === "string" && input.timezone.trim()) ||
    (typeof params?.timezone === "string" && params.timezone.trim()) ||
    process.env.TZ ||
    "UTC";

  const dateFromInput = isDateOnlyString(input.sessionDate)
    ? input.sessionDate
    : toDateOnlyInTimezone(new Date(), timezone);
  const startDate = isDateOnlyString(params?.startDate) ? params.startDate : null;

  let week = clampPositiveInt(input.week, 1);
  let day = clampPositiveInt(input.day, 1);

  if (startDate) {
    const deltaDays = Math.floor((dateOnlyToUtcMs(dateFromInput) - dateOnlyToUtcMs(startDate)) / 86_400_000);
    const schedule = Array.isArray(params?.schedule) ? params.schedule : [];
    const sessionsPerWeek = schedule.length > 0 ? schedule.length : clampPositiveInt(params?.sessionsPerWeek, 7);
    const normalizedDelta = Math.max(0, deltaDays);
    week = Math.floor(normalizedDelta / sessionsPerWeek) + 1;
    day = (normalizedDelta % sessionsPerWeek) + 1;
  }

  const mode = String(params?.sessionKeyMode ?? "").toUpperCase();
  const useDateKey = mode === "DATE";
  const sessionKey = useDateKey ? dateFromInput : `W${week}D${day}`;

  return {
    week,
    day,
    sessionDate: dateFromInput,
    sessionKey,
    timezone,
  } satisfies SessionContext;
}

function pickTrainingMaxKg(params: any, defaults: any, target: string) {
  const keys = [target, target.toLowerCase()];
  const scoped = (obj: any): number | null => {
    if (!obj) return null;
    const asNum = toNumberOrNull(obj);
    if (asNum !== null) return asNum;
    if (typeof obj !== "object") return null;
    for (const k of keys) {
      const n = toNumberOrNull(obj[k]);
      if (n !== null) return n;
    }
    return null;
  };

  return (
    scoped(params?.trainingMaxKg) ??
    scoped(params?.tmKg) ??
    scoped(params?.tm) ??
    scoped(defaults?.trainingMaxKg) ??
    scoped(defaults?.tmKg) ??
    scoped(defaults?.tm) ??
    100
  );
}

function normalizeTargets(def: LogicDefinitionV1, fallback: string[]) {
  const raw = [
    ...(Array.isArray(def.lifts) ? def.lifts : []),
    ...(Array.isArray(def.modules) ? def.modules : []),
    ...(Array.isArray(def.mainLifts) ? def.mainLifts : []),
    ...(Array.isArray(def.cluster) ? def.cluster : []),
    ...fallback,
  ]
    .map((x) => String(x).trim())
    .filter(Boolean)
    .map((x) => normalizeTarget(x));

  const unique: string[] = [];
  for (const t of raw) {
    if (!unique.includes(t)) unique.push(t);
  }
  return unique.length ? unique : ["CUSTOM"];
}

function buildPercentSets(
  tmKg: number,
  rows: Array<{ reps: number; percent: number; note?: string; rpe?: number }>,
) {
  return rows.map((row) => ({
    reps: row.reps,
    percent: row.percent,
    targetWeightKg: roundToNearest2p5(tmKg * row.percent),
    rpe: row.rpe,
    note: row.note,
  }));
}

function buildRepeatedSets(
  count: number,
  row: { reps: number; percent: number; note?: string; rpe?: number },
  tmKg: number,
) {
  return Array.from({ length: count }, () => ({
    reps: row.reps,
    percent: row.percent,
    targetWeightKg: roundToNearest2p5(tmKg * row.percent),
    rpe: row.rpe,
    note: row.note,
  }));
}

function generate531(def: LogicDefinitionV1, ctx: GeneratorCtx): PlannedExercise[] {
  const targets = ctx.forcedTarget
    ? [normalizeTarget(ctx.forcedTarget)]
    : normalizeTargets(def, ["SQUAT", "BENCH", "DEADLIFT", "OHP"]);
  const target = targets[(ctx.day - 1) % targets.length] ?? targets[0];
  const tm = pickTrainingMaxKg(ctx.params, ctx.defaults, target);
  const weekInCycle = ((ctx.week - 1) % 4) + 1;

  const table: Record<number, Array<{ reps: number; percent: number; note?: string }>> = {
    1: [
      { reps: 5, percent: 0.65 },
      { reps: 5, percent: 0.75 },
      { reps: 5, percent: 0.85, note: "5+" },
    ],
    2: [
      { reps: 3, percent: 0.7 },
      { reps: 3, percent: 0.8 },
      { reps: 3, percent: 0.9, note: "3+" },
    ],
    3: [
      { reps: 5, percent: 0.75 },
      { reps: 3, percent: 0.85 },
      { reps: 1, percent: 0.95, note: "1+" },
    ],
    4: [
      { reps: 5, percent: 0.4, note: "deload" },
      { reps: 5, percent: 0.5 },
      { reps: 5, percent: 0.6 },
    ],
  };

  return [
    {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN",
      sourceBlockTarget: target,
      order: ctx.orderBase,
      sets: buildPercentSets(tm, table[weekInCycle] ?? table[1]),
    },
  ];
}

function generateOperator(def: LogicDefinitionV1, ctx: GeneratorCtx): PlannedExercise[] {
  const targets = ctx.forcedTarget
    ? [normalizeTarget(ctx.forcedTarget)]
    : normalizeTargets(def, ["SQUAT", "BENCH", "DEADLIFT"]);
  const weekInCycle = ((ctx.week - 1) % 6) + 1;

  const scheme =
    weekInCycle <= 2
      ? { sets: 5, reps: 5, percent: 0.75 }
      : weekInCycle <= 4
        ? { sets: 5, reps: 4, percent: 0.8 }
        : weekInCycle === 5
          ? { sets: 6, reps: 3, percent: 0.85 }
          : { sets: 3, reps: 5, percent: 0.7, note: "deload" };

  return targets.map((target, i) => {
    const tm = pickTrainingMaxKg(ctx.params, ctx.defaults, target);
    return {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN" as const,
      sourceBlockTarget: target,
      order: ctx.orderBase + i,
      sets: buildRepeatedSets(scheme.sets, scheme, tm),
    };
  });
}

function generateCanditoLinear(def: LogicDefinitionV1, ctx: GeneratorCtx): PlannedExercise[] {
  const weekInCycle = ((ctx.week - 1) % 6) + 1;
  const dayMap = Array.isArray(def.progression?.dayMap)
    ? def.progression.dayMap.map((x: any) => normalizeTarget(String(x)))
    : ["SQUAT", "BENCH", "DEADLIFT", "BENCH"];
  const target = ctx.forcedTarget
    ? normalizeTarget(ctx.forcedTarget)
    : dayMap[(ctx.day - 1) % dayMap.length] ?? dayMap[0];

  const scheme: Record<number, { sets: number; reps: number; percent: number; note?: string }> = {
    1: { sets: 4, reps: 8, percent: 0.7, note: "volume" },
    2: { sets: 4, reps: 6, percent: 0.75 },
    3: { sets: 5, reps: 4, percent: 0.8, note: "strength" },
    4: { sets: 6, reps: 3, percent: 0.85 },
    5: { sets: 4, reps: 2, percent: 0.9, note: "peak" },
    6: { sets: 3, reps: 1, percent: 0.95, note: "test prep" },
  };

  const tm = pickTrainingMaxKg(ctx.params, ctx.defaults, target);
  const s = scheme[weekInCycle] ?? scheme[1];

  return [
    {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN",
      sourceBlockTarget: target,
      order: ctx.orderBase,
      sets: buildRepeatedSets(s.sets, s, tm),
    },
  ];
}

function generateFromLogicDefinition(
  definition: unknown,
  ctx: GeneratorCtx,
): PlannedExercise[] {
  const def = (definition ?? {}) as LogicDefinitionV1;
  const kind = String(def.kind ?? "").toLowerCase();

  if (kind === "531") return generate531(def, ctx);
  if (kind === "operator") return generateOperator(def, ctx);
  if (kind === "candito-linear") return generateCanditoLinear(def, ctx);

  const target = ctx.forcedTarget ? normalizeTarget(ctx.forcedTarget) : "CUSTOM";
  return [
    {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN",
      sourceBlockTarget: target,
      order: ctx.orderBase,
      sets: [{ reps: 5, note: `Unsupported logic kind: ${def.kind ?? "unknown"}` }],
    },
  ];
}

function mapManualSet(s: any): PlannedSet {
  const reps = toNumberOrNull(s?.reps) ?? undefined;
  const targetWeightKg = toNumberOrNull(s?.targetWeightKg ?? s?.weightKg) ?? undefined;
  const percent = toNumberOrNull(s?.percent) ?? undefined;
  const rpe = toNumberOrNull(s?.rpe) ?? undefined;
  const note = typeof s?.note === "string" ? s.note : undefined;
  return { reps, targetWeightKg, percent, rpe, note };
}

function plannedExercisesFromManualSession(manualSession: any): PlannedExercise[] {
  const items = Array.isArray(manualSession?.items) ? manualSession.items : [];
  const out: PlannedExercise[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
    if (!exerciseName) continue;

    const setRows = Array.isArray(item?.sets) && item.sets.length > 0 ? item.sets : [item];
    const sets = setRows.map(mapManualSet);

    out.push({
      exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
      exerciseName,
      role: item?.role === "ASSIST" ? "ASSIST" : "MAIN",
      sets,
      sourceBlockTarget: "MANUAL",
      order: toNumberOrNull(item?.order) ?? i,
    });
  }

  return out;
}

function plannedExercisesFromBlocks(snapshot: any, week: number, day: number, planParams: any) {
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const exercises: PlannedExercise[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const forcedTarget =
      typeof b?.target === "string" && normalizeTarget(b.target) !== "CUSTOM"
        ? normalizeTarget(b.target)
        : undefined;
    const generated = generateFromLogicDefinition(b?.definition, {
      week,
      day,
      params: { ...(planParams ?? {}), ...(b?.params ?? {}) },
      defaults: b?.defaults ?? {},
      forcedTarget,
      orderBase: i * 100,
    });
    exercises.push(...generated);
  }

  return exercises;
}

function reorderBlocks(blocks: any[], order: string[]) {
  const map = new Map(blocks.map((b: any) => [b.target, b]));
  const reordered = order.map((k: string) => map.get(k)).filter(Boolean);
  const remaining = blocks.filter((b: any) => !order.includes(b.target));
  return [...reordered, ...remaining];
}

function sortExercises(exercises: PlannedExercise[]) {
  return exercises
    .slice()
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

function applyOverridesToSnapshot(snapshot: any, overrides: any[]) {
  snapshot.overridesApplied = snapshot.overridesApplied ?? [];
  snapshot.exercises = Array.isArray(snapshot.exercises) ? snapshot.exercises : [];
  snapshot.accessories = Array.isArray(snapshot.accessories) ? snapshot.accessories : [];

  for (const o of overrides) {
    const p = o.patch as Patch;
    if (!p || !("op" in p)) continue;

    if (p.op === "ADD_ACCESSORY") {
      const accessory = {
        exerciseName: p.value.exerciseName,
        sets: p.value.sets ?? [],
        order: p.value.order ?? 99,
        source: { overrideId: o.id },
      };
      snapshot.accessories.push(accessory);

      const plannedAccessory: PlannedExercise = {
        exerciseName: p.value.exerciseName,
        role: "ASSIST",
        sourceBlockTarget: "ACCESSORY",
        order: 10000 + (p.value.order ?? 99),
        sets: (p.value.sets ?? []).map((s) => ({
          reps: toNumberOrNull(s?.reps) ?? undefined,
          targetWeightKg: toNumberOrNull(s?.weightKg) ?? undefined,
          rpe: toNumberOrNull(s?.rpe) ?? undefined,
        })),
      };
      snapshot.exercises.push(plannedAccessory);
      snapshot.overridesApplied.push({ overrideId: o.id, op: p.op });
      continue;
    }

    if (p.op === "REPLACE_EXERCISE") {
      const tgt = (p as any).target?.blockTarget;
      if (tgt && Array.isArray(snapshot.blocks)) {
        const block = snapshot.blocks.find((b: any) => b.target === tgt);
        if (block) {
          block.replacements = block.replacements ?? {};
          block.replacements.mainExercise = p.value.exerciseName;
          block.replacements.source = { overrideId: o.id };
        }
      }

      if (tgt && Array.isArray(snapshot.exercises)) {
        let replaced = 0;
        for (const ex of snapshot.exercises as PlannedExercise[]) {
          if (ex.role === "MAIN" && ex.sourceBlockTarget === tgt) {
            ex.exerciseName = p.value.exerciseName;
            replaced += 1;
          }
        }
        if (replaced === 0 && tgt === "CUSTOM") {
          for (const ex of snapshot.exercises as PlannedExercise[]) {
            if (ex.role === "MAIN") {
              ex.exerciseName = p.value.exerciseName;
            }
          }
        }
      }

      snapshot.overridesApplied.push({ overrideId: o.id, op: p.op, target: tgt });
      continue;
    }

    if (p.op === "REORDER_BLOCKS") {
      const order = (p as any).value?.order;
      if (Array.isArray(order) && Array.isArray(snapshot.blocks)) {
        snapshot.blocks = reorderBlocks(snapshot.blocks, order);
      }
      if (Array.isArray(order) && Array.isArray(snapshot.exercises)) {
        const rank = new Map(order.map((k: string, i: number) => [k, i]));
        snapshot.exercises = snapshot.exercises
          .slice()
          .sort((a: PlannedExercise, b: PlannedExercise) => {
            const ra = rank.has(a.sourceBlockTarget ?? "") ? rank.get(a.sourceBlockTarget ?? "")! : 9999;
            const rb = rank.has(b.sourceBlockTarget ?? "") ? rank.get(b.sourceBlockTarget ?? "")! : 9999;
            if (ra !== rb) return ra - rb;
            return (a.order ?? 9999) - (b.order ?? 9999);
          });
      }
      snapshot.overridesApplied.push({ overrideId: o.id, op: p.op });
      continue;
    }
  }

  if (Array.isArray(snapshot.accessories)) {
    snapshot.accessories.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
  }
  if (Array.isArray(snapshot.exercises)) {
    snapshot.exercises = sortExercises(snapshot.exercises);
  }

  return snapshot;
}

function pickManualSession(definition: any, sessionKey: string) {
  if (!definition || definition.kind !== "manual") return null;
  const sessions = Array.isArray(definition.sessions) ? definition.sessions : [];
  return sessions.find((s: any) => s.key === sessionKey) ?? null;
}

/**
 * Snapshot format v3:
 * - keeps legacy fields: blocks[], accessories[], manualSession
 * - adds normalized planned field:
 *   exercises: [
 *     {
 *       exerciseId?: string,
 *       exerciseName: string,
 *       role: "MAIN" | "ASSIST",
 *       sets: [{ reps, targetWeightKg?, percent?, rpe?, note? }]
 *     }
 *   ]
 */
export async function generateAndSaveSession(input: {
  userId: string;
  planId: string;
  week?: number;
  day?: number;
  sessionDate?: string;
  timezone?: string;
}) {
  const pRows = await db.select().from(planTable).where(eq(planTable.id, input.planId)).limit(1);
  const p = pRows[0];
  if (!p) throw new Error("Plan not found");
  if (p.userId !== input.userId) throw new Error("Forbidden");

  const sessionCtx = deriveSessionContext({
    plan: p,
    week: input.week,
    day: input.day,
    sessionDate: input.sessionDate,
    timezone: input.timezone,
  });
  const sessionKey = sessionCtx.sessionKey;

  const overrides = await db
    .select()
    .from(planOverride)
    .where(
      and(
        eq(planOverride.planId, p.id),
        eq(planOverride.scope, "SESSION"),
        eq(planOverride.sessionKey, sessionKey),
      ),
    );

  let snapshot: any = {
    schemaVersion: 3,
    sessionKey,
    sessionDate: sessionCtx.sessionDate,
    timezone: sessionCtx.timezone,
    week: sessionCtx.week,
    day: sessionCtx.day,
    plan: { id: p.id, type: p.type, name: p.name },
    exercises: [],
  };

  if (p.type === "COMPOSITE") {
    const modules = await db.select().from(planModule).where(eq(planModule.planId, p.id));

    const blocks = await Promise.all(
      modules
        .slice()
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map(async (m) => {
          const v = await db
            .select()
            .from(programVersion)
            .where(eq(programVersion.id, m.programVersionId))
            .limit(1);
          const version = v[0];
          if (!version) throw new Error("Program version not found");

          const t = await db
            .select()
            .from(programTemplate)
            .where(eq(programTemplate.id, version.templateId))
            .limit(1);
          const template = t[0];
          if (!template) throw new Error("Program template not found");

          return {
            target: m.target,
            program: {
              slug: template.slug,
              name: template.name,
              type: template.type,
              version: version.version,
            },
            definition: version.definition,
            defaults: version.defaults ?? {},
            params: m.params ?? {},
          };
        }),
    );

    snapshot.blocks = blocks;
    snapshot.exercises = plannedExercisesFromBlocks(snapshot, sessionCtx.week, sessionCtx.day, p.params ?? {});
    snapshot = applyOverridesToSnapshot(snapshot, overrides);
  } else {
    if (!p.rootProgramVersionId) throw new Error("rootProgramVersionId missing");

    const v = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.id, p.rootProgramVersionId))
      .limit(1);
    const version = v[0];
    if (!version) throw new Error("Program version not found");

    const t = await db
      .select()
      .from(programTemplate)
      .where(eq(programTemplate.id, version.templateId))
      .limit(1);
    const template = t[0];
    if (!template) throw new Error("Program template not found");

    if (p.type === "MANUAL") {
      const schedule = Array.isArray((p.params as any)?.schedule) ? (p.params as any).schedule : [];
      const chosenKey = schedule[sessionCtx.day - 1] ?? schedule[(sessionCtx.day - 1) % schedule.length];
      if (!chosenKey) {
        snapshot.manualSession = null;
        snapshot.manualError = "No schedule entry for this day. Provide plan.params.schedule.";
        snapshot.exercises = [];
      } else {
        snapshot.manualSessionKey = chosenKey;
        snapshot.manualSession = pickManualSession(version.definition, chosenKey);
        if (!snapshot.manualSession) {
          snapshot.manualError = `Manual session '${chosenKey}' not found in program definition`;
        }
        snapshot.exercises = plannedExercisesFromManualSession(snapshot.manualSession);
      }

      snapshot.program = {
        slug: template.slug,
        name: template.name,
        type: template.type,
        version: version.version,
      };

      snapshot = applyOverridesToSnapshot(snapshot, overrides);
    } else {
      snapshot.blocks = [
        {
          target: "CUSTOM",
          program: {
            slug: template.slug,
            name: template.name,
            type: template.type,
            version: version.version,
          },
          definition: version.definition,
          defaults: version.defaults ?? {},
          params: p.params ?? {},
        },
      ];
      snapshot.exercises = plannedExercisesFromBlocks(snapshot, sessionCtx.week, sessionCtx.day, p.params ?? {});
      snapshot = applyOverridesToSnapshot(snapshot, overrides);
    }
  }

  const existing = await db
    .select()
    .from(generatedSession)
    .where(and(eq(generatedSession.planId, p.id), eq(generatedSession.sessionKey, sessionKey)))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(generatedSession)
      .set({ snapshot, updatedAt: new Date() })
      .where(eq(generatedSession.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(generatedSession)
    .values({
      planId: p.id,
      userId: input.userId,
      sessionKey,
      snapshot,
    })
    .returning();

  return created;
}
