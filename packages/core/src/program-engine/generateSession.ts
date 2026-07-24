import { and, eq, inArray, sql } from "drizzle-orm";
import { buildSessionKey } from "@workout/core/session-key";
import { db } from "@workout/core/db/client";
import {
  generatedSession,
  plan as planTable,
  planModule,
  planOverride,
  planRuntimeState,
  programTemplate,
  programVersion,
  workoutLog,
} from "@workout/core/db/schema";
import { extractTrainingMaxOverridesFromState, extractStageOverridesFromState } from "../progression/reducer";
import {
  ASYMPTOTE_CYCLE_COEF,
  ASYMPTOTE_LIGHT_CYCLE_COEF,
  ASYMPTOTE_SESSIONS,
  ASYMPTOTE_SESSION_LABELS,
  ASYMPTOTE_SESSION_NUMBER_BY_LABEL,
  asymptoteDayGap,
  asymptoteShouldDeferAmrap,
  floorToMultiple2p5,
  type AsymptoteTopSetSpec,
} from "./asymptote";
import { roundToNearest2p5 } from "./round";
import type { ManualSet, ManualItem, ManualSession, ManualDefinition, OperatorDefinition, AsymptoteDefinition, Wendler531Definition } from "../program-dsl/schema";
import type { PlanParams, ProgramDefaults } from "../program-dsl/plan-params";
import type { SnapshotV3, SnapshotBlock, LogicBlockSource } from "./snapshot";
import { mapExerciseNameToTarget as inferTargetFromExerciseName } from "@workout/core/strength-engine/target-mapping";
import { EXERCISE_NAMES } from "@workout/core/exercise/catalog";
import {
  lookupProgramFamily,
  usesPercentDerivedSets,
  type ProgramFamilyEntry,
} from "@workout/core/program-store/program-registry";
import { buildSlottedLpSlot } from "@workout/core/program-store/model";
import {
  buildRef5PlanSession,
  isRef5PlanParams,
} from "./ref5-integration";
import { tacticalBarbellCluster } from "@workout/core/program-store/tactical-barbell-blueprint";
import {
  wendler531WeekSets,
  WENDLER_531_FSL_SETS,
  WENDLER_531_FSL_REPS,
  WENDLER_531_BBB_SETS,
  WENDLER_531_BBB_REPS,
  WENDLER_531_BBB_PERCENT,
} from "@workout/core/program-store/wendler531-blueprint";

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
 * LOGIC kind 정의(kind: "531" | "operator" | "asymptote")는 program-dsl의 zod-inferred
 * 판별 유니온(Wendler531Definition/OperatorDefinition/AsymptoteDefinition)으로 타이핑된다.
 * 아래는 normalizeTargets가 세션 타깃을 복원할 때 읽는 필드만 담은 입력 계약 — `modules`는
 * 실 데이터, `lifts`/`mainLifts`/`cluster`는 legacy 방어 리더(zod 스키마엔 없음)라 unknown으로 둔다.
 */
type LiftTargetSource = {
  lifts?: unknown;
  modules?: unknown;
  mainLifts?: unknown;
  cluster?: unknown;
};

type PlannedSet = {
  reps?: number;
  targetWeightKg?: number;
  percent?: number;
  rpe?: number;
  amrap?: boolean;
  note?: string;
  // 하이브리드(Asymptote × Async): AMRAP이 아닌 작업 세트의 "그라인딩 정지" 가이드.
  // true면 UI/유저는 렙 타겟을 다 못 채워도 바가 느려지는 첫 렙에서 멈춘다(자동 보정).
  stopOnGrind?: boolean;
  // v0.5 프라이밍 탑세트(topSet)·v0.5.1 AMRAP 보류(amrapDeferred) 마킹 —
  // UI 배지/배너·분석용 표식일 뿐 진행 로직은 읽지 않는다.
  meta?: { topSet?: true; amrapDeferred?: true };
};

export type PlannedExercise = {
  exerciseId?: string | null;
  exerciseName: string;
  role: "MAIN" | "ASSIST";
  sets: PlannedSet[];
  sourceBlockTarget?: string;
  order?: number;
  rowType?: "AUTO" | "CUSTOM" | null;
  progressionTarget?: "SQUAT" | "BENCH" | "DEADLIFT" | "OHP" | "PULL" | null;
  progressionKey?: string | null;
  // gzclp 정석(v2) 슬롯형 처방의 표시 메타. tier=계층(T1/T2/T3), stage=현재 강등 단계
  // (T1/T2만 0=5×3 → 1=6×2 → 2=10×1; T3는 AMRAP이라 stage 무의미 → null). UI 배지 전용이라
  // 비-v2/타 family에는 부착하지 않는다.
  tier?: "T1" | "T2" | "T3" | null;
  stage?: number | null;
  // texas 주간(v2): 슬롯 요일 역할. 처방 무게 파생(V/R=I×계수)·UI 배지에 쓴다.
  texasRole?: "volume" | "recovery" | "intensity" | null;
  // SS/StrongLifts 정석(v2): 메인 리프트가 고정 reps를 못 채우면 실패로 감지하도록 reps-only
  // plannedRef를 흘릴지 마킹. progressionKey 없이 reps만 흘려 family 진행은 유지한다(저장 경로에서 소비).
  enforcePlannedReps?: boolean;
  // 처방/세션 수행에는 포함되지만 progression reducer의 중량 판정에서는 제외한다.
  // Texas v2 V/R은 I 작업중량에서 파생되므로 I 세션만 진행 기준이다.
  skipProgression?: boolean;
};

export type { PlannedSet };

type GeneratorCtx = {
  week: number;
  day: number;
  params: PlanParams;
  defaults: ProgramDefaults;
  forcedTarget?: string;
  orderBase: number;
};

type ProgressionTarget = NonNullable<PlannedExercise["progressionTarget"]>;

type SessionContext = {
  cycle: number;
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
  if (t === "SQUAT") return EXERCISE_NAMES.highBarBackSquat;
  if (t === "BENCH") return "Bench Press";
  if (t === "DEADLIFT") return "Deadlift";
  if (t === "OHP") return "Overhead Press";
  if (t === "PULL") return "Pull-Up";
  return "Main Lift";
}

function normalizeProgressionTarget(value: unknown): "SQUAT" | "BENCH" | "DEADLIFT" | "OHP" | "PULL" | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "SQUAT" || normalized === "BENCH" || normalized === "DEADLIFT" || normalized === "OHP" || normalized === "PULL") {
    return normalized;
  }
  return inferTargetFromExerciseName(String(value ?? ""));
}

function manualExerciseKey(exerciseName: string) {
  return `EX_${String(exerciseName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)}`;
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
  plan: { params?: unknown };
  week?: number;
  day?: number;
  sessionDate?: string;
  timezone?: string;
  runtimeState?: unknown;
}) {
  // plan.params(jsonb)는 저장 형태가 느슨하지만 여기서 읽는 필드(timezone·startDate·
  // autoProgression·schedule·sessionsPerWeek·sessionKeyMode)는 전부 PlanParams 계약 → 경계 캐스트.
  const params = (input.plan?.params ?? {}) as PlanParams;
  const runtimeState =
    input.runtimeState && typeof input.runtimeState === "object" && !Array.isArray(input.runtimeState)
      ? (input.runtimeState as Record<string, unknown>)
      : null;
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
  let cycle = 1;
  const hasExplicitWeek = typeof input.week === "number" && Number.isFinite(input.week);
  const hasExplicitDay = typeof input.day === "number" && Number.isFinite(input.day);
  const autoProgressionEnabled = params?.autoProgression === true;
  const hasRuntimeCycle = toNumberOrNull(runtimeState?.cycle) !== null;
  const hasRuntimeWeek = toNumberOrNull(runtimeState?.week) !== null;
  const hasRuntimeDay = toNumberOrNull(runtimeState?.day) !== null;
  const useRuntimeProgression = autoProgressionEnabled && !hasExplicitWeek && !hasExplicitDay && (hasRuntimeWeek || hasRuntimeDay);

  if (useRuntimeProgression) {
    cycle = clampPositiveInt(runtimeState?.cycle, cycle);
    week = clampPositiveInt(runtimeState?.week, week);
    day = clampPositiveInt(runtimeState?.day, day);
  } else {
    if (autoProgressionEnabled && hasRuntimeCycle) {
      cycle = clampPositiveInt(runtimeState?.cycle, cycle);
    }
    if (startDate && !hasExplicitWeek && !hasExplicitDay) {
      const deltaDays = Math.floor((dateOnlyToUtcMs(dateFromInput) - dateOnlyToUtcMs(startDate)) / 86_400_000);
      const schedule = Array.isArray(params?.schedule) ? params.schedule : [];
      const sessionsPerWeek = schedule.length > 0 ? schedule.length : clampPositiveInt(params?.sessionsPerWeek, 7);
      const normalizedDelta = Math.max(0, deltaDays);
      week = Math.floor(normalizedDelta / sessionsPerWeek) + 1;
      day = (normalizedDelta % sessionsPerWeek) + 1;
    }
  }

  const mode = String(params?.sessionKeyMode ?? "").toUpperCase();
  const sessionKey = buildSessionKey({
    mode,
    sessionDate: dateFromInput,
    cycle,
    week,
    day,
    autoProgression: autoProgressionEnabled,
  });

  return {
    cycle,
    week,
    day,
    sessionDate: dateFromInput,
    sessionKey,
    timezone,
  } satisfies SessionContext;
}

function normalizeLookupKeys(keys: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      keys
        .flatMap((key) => {
          const normalized = String(key ?? "").trim();
          return normalized ? [normalized, normalized.toLowerCase()] : [];
        })
        .filter(Boolean),
    ),
  );
}

function pickTrainingMaxKgByKeys(params: PlanParams, defaults: ProgramDefaults, rawKeys: Array<string | null | undefined>) {
  const keys = normalizeLookupKeys(rawKeys);
  if (keys.length < 1) return null;
  const scoped = (obj: unknown): number | null => {
    if (!obj) return null;
    const asNum = toNumberOrNull(obj);
    if (asNum !== null) return asNum;
    if (typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    for (const k of keys) {
      const n = toNumberOrNull(rec[k]);
      if (n !== null) return n;
    }
    return null;
  };

  const value = (
    scoped(params?.trainingMaxKg) ??
    scoped(params?.tmKg) ??
    scoped(params?.tm) ??
    scoped(defaults?.trainingMaxKg) ??
    scoped(defaults?.tmKg) ??
    scoped(defaults?.tm)
  );
  if (value === null || value <= 0) return null;
  return value;
}

function pickTrainingMaxKg(params: PlanParams, defaults: ProgramDefaults, target: string) {
  return pickTrainingMaxKgByKeys(params, defaults, [target]);
}

function resolveOperatorExerciseTrainingMax(input: {
  effectiveParams: PlanParams;
  baseParams: PlanParams;
  defaults: ProgramDefaults;
  exerciseName: string;
  fallbackTarget: string | null;
}) {
  const exactKey = manualExerciseKey(input.exerciseName);
  const exactTm =
    pickTrainingMaxKgByKeys(input.effectiveParams, input.defaults, [exactKey]) ??
    pickTrainingMaxKgByKeys(input.baseParams, input.defaults, [exactKey]);

  if (!input.fallbackTarget) {
    return exactTm;
  }

  const effectiveFamilyTm = pickTrainingMaxKg(input.effectiveParams, input.defaults, input.fallbackTarget);
  if (exactTm === null) {
    // 운동별 TM도 family TM도 없으면 여기서 무게를 짓지 않고 null을 반환한다(family TM이 있으면
    // 그건 직접 입력이므로 사용). 호출부가 reps-only 행으로 만들고, applyDerivedMainLifts가
    // "같은 세션 스쿼트/벤치 처방"에서 파생한다(데드←스쿼트×1.0, 오프←벤치×0.5). 예전엔
    // crossLiftFallbackTm으로 TM을 추정했으나, 그 경로는 처방무게가 아닌 TM에서 반내림해 같은
    // 오프라도 AUTO 행과 CUSTOM(0무게) 행이 최대 2.5kg 다르게 처방되는 발산을 만들었다. 파생
    // 정책을 applyDerivedMainLifts 하나로 통일한다(#476 후속): 소스가 같은 세션에 있으면 그
    // 처방에서, 없으면(프레스 데이 등) applyDerivedMainLifts 2순위가 crossLiftFallbackTm TM 추정으로
    // 처방하므로 rowType과 무관하게 같은 결과가 된다.
    return effectiveFamilyTm;
  }

  if (effectiveFamilyTm === null) {
    return exactTm;
  }

  const baseFamilyTm = pickTrainingMaxKg(input.baseParams, input.defaults, input.fallbackTarget);
  // No family-level baseline in plan params (older plans, or plans created
  // without the start-program family fallback). Treat the per-exercise TM as
  // the implicit family baseline so the runtime override delta still reaches
  // the prescribed weight.
  const familyBaseline = baseFamilyTm ?? exactTm;
  return roundToNearest2p5(exactTm + (effectiveFamilyTm - familyBaseline));
}

function requireTrainingMaxKg(params: PlanParams, defaults: ProgramDefaults, target: string) {
  const tm = pickTrainingMaxKg(params, defaults, target);
  if (tm === null) {
    throw new Error(`1RM/TM 입력이 필요합니다: ${target}`);
  }
  return tm;
}

function normalizeTargets(def: LiftTargetSource, fallback: string[]) {
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
  rows: Array<{
    reps: number;
    percent: number;
    note?: string;
    rpe?: number;
    amrap?: boolean;
  }>,
) {
  return rows.map((row) => ({
    reps: row.reps,
    percent: row.percent,
    targetWeightKg: roundToNearest2p5(tmKg * row.percent),
    rpe: row.rpe,
    amrap: row.amrap === true,
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

function buildRepeatedRepOnlySets(
  count: number,
  row: { reps: number; note?: string; rpe?: number },
) {
  return Array.from({ length: count }, () => ({
    reps: row.reps,
    rpe: row.rpe,
    note: row.note,
  }));
}

function normalizeManualRowType(value: unknown): "AUTO" | "CUSTOM" | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "AUTO" || normalized === "ANCHOR" || normalized === "FLEX") return "AUTO";
  if (normalized === "CUSTOM") return "CUSTOM";
  return null;
}

function operatorSchemeByWeek(week: number) {
  const scheme: Record<number, { reps: number; percent: number; note: string }> = {
    1: { reps: 5, percent: 0.7, note: "Operator W1" },
    2: { reps: 5, percent: 0.8, note: "Operator W2" },
    3: { reps: 3, percent: 0.9, note: "Operator W3" },
    4: { reps: 5, percent: 0.75, note: "Operator W4" },
    5: { reps: 3, percent: 0.85, note: "Operator W5" },
    6: { reps: 1, percent: 0.95, note: "Operator W6" },
  };
  return scheme[((week - 1) % 6) + 1] ?? scheme[1];
}

function generate531(def: Wendler531Definition, ctx: GeneratorCtx): PlannedExercise[] {
  const targets = ctx.forcedTarget
    ? [normalizeTarget(ctx.forcedTarget)]
    : normalizeTargets(def, ["SQUAT", "BENCH", "DEADLIFT", "OHP"]);
  const target = targets[(ctx.day - 1) % targets.length] ?? targets[0];
  const tm = requireTrainingMaxKg(ctx.params, ctx.defaults, target);
  const progressionTarget = normalizeProgressionTarget(target);

  // 공식 5/3/1 메인 세트 테이블은 wendler531-blueprint(단일 진실원)에서 가져온다.
  const weekSets = wendler531WeekSets(ctx.week);
  const firstSetPercent = weekSets[0]?.percent ?? 0.65;

  const exercises: PlannedExercise[] = [
    {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN",
      rowType: "AUTO",
      sourceBlockTarget: target,
      order: ctx.orderBase,
      progressionTarget: progressionTarget ?? null,
      progressionKey: target,
      sets: buildPercentSets(tm, weekSets),
    },
  ];

  const assistance = String(def.assistance ?? "NONE").toUpperCase();

  if (assistance === "FSL") {
    // FSL(First Set Last): 5×5 — 메인 첫 번째 세트 중량으로 5세트 반복
    exercises.push({
      exerciseName: defaultExerciseNameForTarget(target),
      role: "ASSIST",
      skipProgression: true,
      sourceBlockTarget: `${target}_FSL`,
      order: ctx.orderBase + 1,
      sets: Array.from({ length: 5 }, () => ({
        reps: 5,
        percent: firstSetPercent,
        targetWeightKg: roundToNearest2p5(tm * firstSetPercent),
        note: "FSL",
      })),
    });
  } else if (assistance === "BBB") {
    // BBB(Boring But Big): 5×10 — TM의 50%로 5세트 10회
    exercises.push({
      exerciseName: defaultExerciseNameForTarget(target),
      role: "ASSIST",
      skipProgression: true,
      sourceBlockTarget: `${target}_BBB`,
      order: ctx.orderBase + 1,
      sets: Array.from({ length: 5 }, () => ({
        reps: 10,
        percent: 0.50,
        targetWeightKg: roundToNearest2p5(tm * 0.50),
        note: "BBB",
      })),
    });
  }

  return exercises;
}

function generateOperator(def: OperatorDefinition, ctx: GeneratorCtx): PlannedExercise[] {
  // 템플릿별 요일 클러스터. 6주 파형(70/80/90/75/85/95)과 블록 증량 규칙은 셋이 공유하고,
  // 차이는 주당 세션 수와 세션별 리프트 구성뿐이다(TB 공식: 같은 파형, 다른 스케줄).
  const cluster = tacticalBarbellCluster(def.variant);
  const dayInWeek = ((ctx.day - 1) % cluster.length) + 1;
  const forcedTarget = normalizeProgressionTarget(ctx.forcedTarget);
  const targets: ProgressionTarget[] = forcedTarget
    ? [forcedTarget]
    : (cluster[dayInWeek - 1] ?? cluster[0]!);
  const weekInCycle = ((ctx.week - 1) % 6) + 1;
  const mainSets = Math.min(
    5,
    Math.max(3, clampPositiveInt(def.progression?.mainSets ?? 3, 3)),
  );
  const deadliftSets = Math.min(
    5,
    Math.max(1, clampPositiveInt(def.progression?.deadliftSets ?? 3, 3)),
  );

  const scheme = operatorSchemeByWeek(weekInCycle);

  // operator 정석(v2): 블록 완주(W6D3) 시 처방 reps 미달을 실패로 감지하기 위해 MAIN 행에
  // enforcePlannedReps 마킹 → 저장 경로가 progressionKey 없는 reps-only plannedRef를 흘려
  // setWasCompleted가 reps>=plannedReps로 검증한다. 블록 게이트(reducer)가 failureStreak로
  // W6D3 미달 시 증량을 차단(TB 공식: 블록 완주=W6 수행 기준 평가). forward-only.
  const enforceReps = (ctx.params as Record<string, unknown>)?.progressionModel === "v2";

  return targets.map((target, i) => {
    const setCount = target === "DEADLIFT" ? deadliftSets : mainSets;
    const tm =
      pickTrainingMaxKg(ctx.params, ctx.defaults, target) ??
      crossLiftFallbackTm(target, ctx.params, ctx.defaults);
    return {
      exerciseName: defaultExerciseNameForTarget(target),
      role: "MAIN" as const,
      sourceBlockTarget: target,
      order: ctx.orderBase + i,
      rowType: "AUTO",
      progressionTarget: target,
      progressionKey: target,
      sets:
        tm !== null
          ? buildRepeatedSets(setCount, scheme, tm)
          : buildRepeatedRepOnlySets(setCount, scheme),
      enforcePlannedReps: enforceReps ? true : undefined,
    };
  });
}

// TB 계열(operator·asymptote) 공통 폴백: 직접 TM이 없는 보조 리프트를 인접 메인
// 리프트에서 추정한다. 데드리프트는 스쿼트 TM을, 오버헤드프레스는 벤치 TM의 50%
// (2.5kg 내림)를 차용한다. 사용자가 메인 3리프트(스쿼트/벤치/풀)의 TM만 입력해도
// 데드/오프 처방이 0으로 비지 않도록 하는 안전망 — 직접 TM이 있으면 호출부에서
// 항상 그쪽을 우선하므로 이 추정은 "직접 입력이 아예 없을 때"만 작동한다.
function crossLiftFallbackTm(target: string, params: PlanParams, defaults: ProgramDefaults): number | null {
  if (target === "DEADLIFT") return pickTrainingMaxKg(params, defaults, "SQUAT");
  if (target === "OHP") {
    const bpTm = pickTrainingMaxKg(params, defaults, "BENCH");
    if (bpTm === null) return null;
    return Math.floor((bpTm * 0.5) / 2.5) * 2.5;
  }
  return null;
}

function resolveAsymptoteTm(
  target: ProgressionTarget,
  params: PlanParams,
  defaults: ProgramDefaults,
): number | null {
  if (target === "SQUAT" || target === "BENCH" || target === "PULL") {
    return pickTrainingMaxKg(params, defaults, target);
  }
  if (target === "DEADLIFT" || target === "OHP") {
    return pickTrainingMaxKg(params, defaults, target) ?? crossLiftFallbackTm(target, params, defaults);
  }
  return null;
}

// v0.5 프라이밍 탑세트(proximity patch §A.1) — LOGIC·slot 두 처방 경로가 공유하는 단일 생성기
// (동작 일치를 구조로 보장). 발동: topSet 스펙 보유 + 발동 사이클(2·3) + 비-lightBlockMode.
// 처방: 1×reps @ TM×cycleCoef×coef(=1.0), stopOnGrind 고정, amrap 금지(진행 신호 아님),
// meta.topSet 마킹. RPE는 비워둔다 — 근최대 노출이라 사이클 기본 RPE(7·8)가 오히려 오도하고,
// 그라인딩-정지가 유일한 강도 밸브다. 렙 미달은 실패가 아니며 failureStreak에 반영되지 않는다
// (asymptote 저장 경로는 plannedRef를 스탬프하지 않아 reducer의 setWasCompleted가 렙 비교를
// 하지 않고, AMRAP 수집은 마지막 세트 기준이라 선두 삽입과 무간섭 — reducer 무변경, §A.3).
function buildAsymptoteTopSet(input: {
  spec: AsymptoteTopSetSpec | undefined;
  cycleInBlock: number;
  lightBlockMode: boolean;
  tm: number | null;
  cycleCoef: number;
  baseTag: string;
}): PlannedSet | null {
  const spec = input.spec;
  if (!spec || input.lightBlockMode || !spec.cycles.includes(input.cycleInBlock)) return null;
  const set: PlannedSet = {
    reps: spec.reps,
    percent: input.cycleCoef * spec.coef,
    amrap: false,
    stopOnGrind: true,
    note: `${input.baseTag} · 프라이밍 탑세트 · 그라인딩 정지`,
    meta: { topSet: true },
  };
  const weightKg =
    input.tm !== null ? floorToMultiple2p5(input.tm * input.cycleCoef * spec.coef) : null;
  if (weightKg !== null) set.targetWeightKg = weightKg;
  return set;
}

// v0.5.1 F3: 처방에 보류된 AMRAP 세트가 있는지 — snapshot.amrapDeferred 승격의 단일 판정원.
export function plannedExercisesHaveDeferredAmrap(exercises: unknown): boolean {
  if (!Array.isArray(exercises)) return false;
  return exercises.some(
    (exercise) =>
      Array.isArray((exercise as PlannedExercise)?.sets) &&
      (exercise as PlannedExercise).sets.some((set) => set?.meta?.amrapDeferred === true),
  );
}

function generateAsymptote(_def: AsymptoteDefinition, ctx: GeneratorCtx): PlannedExercise[] {
  // Asymptote Protocol: ctx.week ∈ {1..4} = 블록 내 사이클, ctx.day ∈ {1..3} = 세션 A/B/C.
  // ctx.params.lightBlockMode === true 면 light 계수 사용 (이전 블록 AMRAP ≤2 트리거).
  const cycleInBlock = ((ctx.week - 1) % 4) + 1;
  const sessionInCycle = ((ctx.day - 1) % 3) + 1;
  const lightBlockMode = (ctx.params as Record<string, unknown> | undefined)?.lightBlockMode === true;
  const cycleCoef =
    (lightBlockMode ? ASYMPTOTE_LIGHT_CYCLE_COEF : ASYMPTOTE_CYCLE_COEF)[cycleInBlock] ??
    ASYMPTOTE_CYCLE_COEF[1]!;
  const isAmrapCycle = cycleInBlock === 3 && !lightBlockMode;
  // 하이브리드 연속일 AMRAP 가드: 직전 세션과의 간격(일). 미지정이면 보류하지 않음(기존 동작).
  const restDayGap = toNumberOrNull((ctx.params as Record<string, unknown> | undefined)?.restDayGap);
  const session = ASYMPTOTE_SESSIONS[sessionInCycle] ?? ASYMPTOTE_SESSIONS[1]!;
  const sessionLabel = ASYMPTOTE_SESSION_LABELS[sessionInCycle] ?? "A";
  // 처방 RPE: light block은 비움(회복 주간). 일반 cycle은 강도 점증:
  // C1→6 (warm), C2→7 (steady), C3 non-AMRAP→8 (heavy). AMRAP 세트는 비워서 실측 RIR로 사용.
  const cycleBaseRpe = lightBlockMode
    ? null
    : cycleInBlock === 1
      ? 6
      : cycleInBlock === 2
        ? 7
        : 8;

  return session.map((row, i) => {
    const tm = resolveAsymptoteTm(row.target, ctx.params, ctx.defaults);
    const workingWeightKg = tm !== null ? floorToMultiple2p5(tm * cycleCoef * row.coef) : null;
    const baseTag = `Asymptote C${cycleInBlock}${sessionLabel}${lightBlockMode ? " · light" : ""}`;
    const sets: PlannedSet[] = Array.from({ length: row.sets }, (_, setIdx) => {
      const isLastSet = setIdx === row.sets - 1;
      const amrapEligible = isAmrapCycle && row.amrap && isLastSet;
      const deferAmrap = asymptoteShouldDeferAmrap({ amrapEligible, restDayGap });
      const isAmrapSet = amrapEligible && !deferAmrap;
      const note = isAmrapSet
        ? `${baseTag} · AMRAP ${row.reps}+`
        : deferAmrap
          ? `${baseTag} · AMRAP 보류(연속일) · 그라인딩 정지`
          : row.note
            ? `${baseTag} · ${row.note} · 그라인딩 정지`
            : `${baseTag} · 그라인딩 정지`;
      const set: PlannedSet = {
        reps: row.reps,
        percent: cycleCoef * row.coef,
        amrap: isAmrapSet,
        note,
      };
      if (workingWeightKg !== null) set.targetWeightKg = workingWeightKg;
      if (cycleBaseRpe !== null && !isAmrapSet) set.rpe = cycleBaseRpe;
      // 비-AMRAP 작업 세트는 그라인딩-정지 가이드(자동 보정 밸브).
      if (!isAmrapSet) set.stopOnGrind = true;
      // v0.5.1 F3: 보류된 AMRAP을 세트 메타로 마킹 — 세션 수준 배너(snapshot.amrapDeferred)의 근거.
      if (deferAmrap) set.meta = { amrapDeferred: true };
      return set;
    });
    // v0.5 프라이밍 탑세트: 작업 세트 앞(선두)에 삽입 — AMRAP은 마지막 세트 판정이라 무간섭.
    const topSet = buildAsymptoteTopSet({
      spec: row.topSet,
      cycleInBlock,
      lightBlockMode,
      tm,
      cycleCoef,
      baseTag,
    });
    if (topSet) sets.unshift(topSet);

    return {
      exerciseName: row.name,
      role: "MAIN" as const,
      sourceBlockTarget: row.target,
      order: ctx.orderBase + i,
      rowType: "AUTO",
      progressionTarget: row.target,
      progressionKey: row.target,
      sets,
    };
  });
}

// Exported for the DSL golden-master harness (docs/program-dsl-typing-plan.md, Phase 0).
// This is the real dispatch the DB session path uses for LOGIC-type definitions
// (531/operator/asymptote); pinning its output guards the upcoming DSL retyping.
export function generateFromLogicDefinition(
  definition: unknown,
  ctx: GeneratorCtx,
): PlannedExercise[] {
  const def = (definition ?? {}) as { kind?: unknown };
  const kind = String(def.kind ?? "").toLowerCase();

  // kind 문자열 매칭으로 이미 판별됨 → 해당 kind의 zod-inferred 타입으로 경계 캐스트.
  // (raw는 unknown 계열이라 판별 유니온 멤버로의 단일 캐스트가 안전; 런타임 무변경.)
  if (kind === "531") return generate531(def as unknown as Wendler531Definition, ctx);
  if (kind === "operator") return generateOperator(def as unknown as OperatorDefinition, ctx);
  if (kind === "asymptote") return generateAsymptote(def as unknown as AsymptoteDefinition, ctx);

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

function mapManualSet(s: ManualSet): PlannedSet {
  const reps = toNumberOrNull(s?.reps) ?? undefined;
  const targetWeightKg = toNumberOrNull(s?.targetWeightKg ?? s?.weightKg) ?? undefined;
  const percent = toNumberOrNull(s?.percent) ?? undefined;
  const rpe = toNumberOrNull(s?.rpe) ?? undefined;
  const note = typeof s?.note === "string" ? s.note : undefined;
  return { reps, targetWeightKg, percent, rpe, note };
}

export function plannedExercisesFromManualSession(
  manualSession: ManualSession | null,
  options?: { injectAmrapLastMainSet?: boolean; enforcePlannedReps?: boolean },
): PlannedExercise[] {
  const items: ManualItem[] =
    manualSession && Array.isArray(manualSession.items) ? manualSession.items : [];
  const out: PlannedExercise[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
    if (!exerciseName) continue;

    const setRows = Array.isArray(item?.sets) && item.sets.length > 0 ? item.sets : [item];
    const sets = setRows.map(mapManualSet);
    const role = item?.role === "ASSIST" ? "ASSIST" : "MAIN";

    // Greyskull 정석(v2): 메인 리프트 마지막 세트를 기능적 AMRAP(5+)으로 표시. mapManualSet이
    // seed의 amrap 플래그를 보존하지 않고(시드는 note만 "AMRAP 5+"), reducer가 meta.amrap의 실측
    // reps로 더블 프로그레션/디로드를 판정하므로 여기서 명시 주입한다. forward-only(v2)일 때만.
    if (options?.injectAmrapLastMainSet && role === "MAIN" && sets.length > 0) {
      const lastSet = sets[sets.length - 1];
      if (lastSet) (lastSet as PlannedSet).amrap = true;
    }

    const explicitProgressionTarget = normalizeProgressionTarget(
      item?.progressionTarget ?? item?.meta?.progressionTarget,
    );
    // 공개 SS/StrongLifts seed는 운동명만 있고 progressionTarget 필드는 없다.
    // v2 처방 reps 검증을 켠 경우 운동명에서 family target을 복원해야
    // enforcePlannedReps → log.meta.plannedRef.reps 경로가 실제 seed에서도 이어진다.
    const progressionTarget =
      explicitProgressionTarget ??
      (options?.enforcePlannedReps ? inferTargetFromExerciseName(exerciseName) : null);

    out.push({
      exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
      exerciseName,
      role,
      sets,
      sourceBlockTarget: "MANUAL",
      order: toNumberOrNull(item?.order) ?? i,
      rowType: normalizeManualRowType(item?.rowType ?? item?.slotRole ?? item?.meta?.rowType ?? item?.meta?.slotRole),
      progressionTarget,
      progressionKey: null,
      // SS/StrongLifts 정석(v2): 메인 리프트가 고정 reps를 못 채우면 실패로 감지하도록 마킹.
      // AMRAP 자기조절(greyskull)과 달리 "처방 reps 미달=실패". progressionTarget이 매핑되는
      // MAIN 행에만 부착 — ASSIST·bodyweight 미매핑 행은 제외(저장 경로가 reps-only plannedRef로 소비).
      enforcePlannedReps:
        options?.enforcePlannedReps === true && role === "MAIN" && Boolean(progressionTarget)
          ? true
          : undefined,
      // 보조 운동은 진행 판정에서 뺀다. reducer는 plannedRef가 없으면 운동명으로 family를
      // 되짚으므로(progressionIdentityForSet), 표시만 ASSIST로 두면 PPL의 Seated Row가
      // Barbell Row(PULL) 판정에, Incline DB Bench가 Bench(BENCH) 판정에 섞인다.
      skipProgression: role === "ASSIST" ? true : undefined,
    });
  }

  return out;
}

// operator manual 정책: 데드리프트/오버헤드프레스가 직접 무게를 갖지 않으면(미입력), 같은 세션에서
// 이미 처방된 스쿼트/벤치의 "그 주차 작업무게·횟수"를 따른다 — 데드 무게 = 스쿼트 × 1.0,
// 오프 무게 = 벤치 × 0.5, 횟수(reps)도 스쿼트/벤치 그대로(예: 스쿼트 100×3 → 데드 100×3,
// 벤치 90×3 → 오프 45×3). 단 세트수는 사용자가 커스터마이즈한 원래 구성을 유지한다(데드를
// 1세트로 짰으면 1세트 그대로 두고 무게·횟수만 추종). TM·주차%를 다시 계산하지 않고 이미 계산된
// 처방에 종속시키므로 스쿼트/벤치가 override로 바뀌면 함께 움직인다. 직접 무게를 넣었거나
// 자체 TM이 있는 행은 손대지 않는다.
const DERIVED_MAIN_LIFT: Record<string, { from: ProgressionTarget; ratio: number }> = {
  DEADLIFT: { from: "SQUAT", ratio: 1 },
  OHP: { from: "BENCH", ratio: 0.5 },
};

function applyDerivedMainLifts(
  planned: PlannedExercise[],
  week: number,
  effectiveParams: PlanParams,
  baseParams: PlanParams,
  defaults: ProgramDefaults,
): PlannedExercise[] {
  const scheme = operatorSchemeByWeek(week);
  const byTarget = new Map<string, PlannedExercise>();
  for (const ex of planned) {
    if (ex.progressionTarget) byTarget.set(ex.progressionTarget, ex);
  }
  for (const ex of planned) {
    const rule = ex.progressionTarget ? DERIVED_MAIN_LIFT[ex.progressionTarget] : undefined;
    if (!rule) continue;
    // 이미 무게가 잡혀 있으면(자체 TM 처방 또는 사용자 직접 입력) 파생하지 않는다.
    if (!ex.sets.every((s) => !s.targetWeightKg)) continue;

    const srcEx = byTarget.get(rule.from);
    if (srcEx) {
      // (1순위) 파생 소스(스쿼트/벤치)가 같은 세션에 있으면 그 "처방"을 따른다 — 런타임 override로
      // 소스가 바뀌면 함께 움직인다. operator 메인은 전 세트 균일 처방이라 첫 세트를 대표로 쓴다.
      // 소스가 아직 무게가 없으면(자체 TM 없어 rep-only) 무게는 비우되 reps는 그대로 추종한다.
      // 세트수는 원래 커스터마이즈한 구성을 유지하고, 각 세트의 횟수(reps)·무게만 추종한다.
      const srcSet = srcEx.sets[0];
      const targetWeightKg =
        srcSet && typeof srcSet.targetWeightKg === "number"
          ? roundToNearest2p5(srcSet.targetWeightKg * rule.ratio)
          : undefined;
      ex.sets = ex.sets.map((s) => ({ ...s, reps: srcSet?.reps, percent: srcSet?.percent, targetWeightKg }));
      continue;
    }

    // (2순위) 소스가 세션에 없으면(override로 스쿼트/벤치를 뺀 프레스 데이 등) 인접 메인 리프트
    // TM으로 추정 처방한다(데드←스쿼트 TM, 오프←벤치 TM×0.5 = crossLiftFallbackTm). 예전엔
    // resolveOperatorExerciseTrainingMax가 AUTO 행에만 이 추정을 적용해 CUSTOM(0무게, 처방 파생)
    // 행과 최대 2.5kg 어긋났다 — 안전망을 여기로 모아 rowType 무관 동일 결과를 낸다. TM도 없으면
    // rep-only로 남긴다.
    const fallbackTm =
      crossLiftFallbackTm(ex.progressionTarget!, effectiveParams, defaults) ??
      crossLiftFallbackTm(ex.progressionTarget!, baseParams, defaults);
    if (fallbackTm === null) continue;
    const targetWeightKg = roundToNearest2p5(fallbackTm * scheme.percent);
    ex.sets = ex.sets.map((s) => ({ ...s, reps: scheme.reps, percent: scheme.percent, targetWeightKg }));
  }
  return planned;
}

export function plannedExercisesFromOperatorManualSession(
  manualSession: ManualSession | null,
  week: number,
  effectiveParams: PlanParams,
  baseParams: PlanParams,
  defaults: ProgramDefaults,
): PlannedExercise[] {
  const items: ManualItem[] =
    manualSession && Array.isArray(manualSession.items) ? manualSession.items : [];
  const scheme = operatorSchemeByWeek(week);
  const mainSets = 3;
  const deadliftSets = 3;
  // operator 정석(v2): AUTO(MAIN) 행에 enforcePlannedReps 마킹 → 저장 경로가 progressionKey 없는
  // reps-only plannedRef를 흘려 블록 완주(W6D3) 시 reps 미달을 실패로 감지. CUSTOM 행은 제외
  // (ASSIST·progressionTarget 미보장). EX_ progressionKey는 그대로 두되 plannedRef엔 안 실린다.
  const enforceReps = (effectiveParams as Record<string, unknown>)?.progressionModel === "v2";

  const planned = items
    .map((item, index: number): PlannedExercise | null => {
      const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
      if (!exerciseName) return null;

      const rowType = normalizeManualRowType(item?.rowType ?? item?.slotRole ?? item?.meta?.rowType ?? item?.meta?.slotRole);
      const progressionTarget =
        normalizeProgressionTarget(item?.progressionTarget ?? item?.meta?.progressionTarget) ??
        inferTargetFromExerciseName(exerciseName);

      if (rowType === "AUTO") {
        const setCount = progressionTarget === "DEADLIFT" ? deadliftSets : mainSets;
        const tm = resolveOperatorExerciseTrainingMax({
          effectiveParams,
          baseParams,
          defaults,
          exerciseName,
          fallbackTarget: progressionTarget,
        });
        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: "MAIN" as const,
          sourceBlockTarget: progressionTarget ?? "CUSTOM",
          order: toNumberOrNull(item?.order) ?? index,
          rowType,
          progressionTarget: progressionTarget ?? null,
          progressionKey: manualExerciseKey(exerciseName),
          sets:
            tm !== null
              ? buildRepeatedSets(setCount, scheme, tm)
              : buildRepeatedRepOnlySets(setCount, scheme),
          enforcePlannedReps: enforceReps && Boolean(progressionTarget) ? true : undefined,
        } satisfies PlannedExercise;
      }

      const setRows = Array.isArray(item?.sets) && item.sets.length > 0 ? item.sets : [item];
      return {
        exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
        exerciseName,
        role: item?.role === "ASSIST" ? "ASSIST" : "MAIN",
        sets: setRows.map(mapManualSet),
        sourceBlockTarget: progressionTarget ?? "CUSTOM",
        order: toNumberOrNull(item?.order) ?? index,
        rowType: rowType ?? "CUSTOM",
        progressionTarget: progressionTarget ?? null,
        progressionKey: null,
      } satisfies PlannedExercise;
    })
    .filter((exercise: PlannedExercise | null): exercise is PlannedExercise => Boolean(exercise));
  // 데드/오프 등 무게 미입력 보조 메인 리프트를 같은 세션 스쿼트/벤치 처방에서 파생(소스가 세션에
  // 없으면 인접 메인 TM 추정으로 폴백).
  return applyDerivedMainLifts(planned, week, effectiveParams, baseParams, defaults);
}

// 슬롯형(asymptote) 커스터마이즈 프로그램의 처방. generateAsymptote(LOGIC 경로)와 동일한 사이클
// 흐름을 쓰되, 고정 ASYMPTOTE_SESSIONS 대신 manual 세션의 각 item이 들고 있는 슬롯 메타(slot.coef·
// amrap·sessionKey)를 사용한다. 따라서 유저가 슬롯의 운동명을 바꿔도 흐름은 슬롯에 종속되어 유지된다.
// progressionKey는 family(target)로 둬 reducer의 asymptote AMRAP 게이팅과 호환된다.
export function plannedExercisesFromAsymptoteManualSession(
  manualSession: ManualSession | null,
  week: number,
  effectiveParams: PlanParams,
  defaults: ProgramDefaults,
): PlannedExercise[] {
  const items: ManualItem[] =
    manualSession && Array.isArray(manualSession.items) ? manualSession.items : [];
  const cycleInBlock = ((week - 1) % 4) + 1;
  const lightBlockMode =
    (effectiveParams as Record<string, unknown> | undefined)?.lightBlockMode === true;
  const cycleCoef =
    (lightBlockMode ? ASYMPTOTE_LIGHT_CYCLE_COEF : ASYMPTOTE_CYCLE_COEF)[cycleInBlock] ??
    ASYMPTOTE_CYCLE_COEF[1]!;
  const isAmrapCycle = cycleInBlock === 3 && !lightBlockMode;
  const cycleBaseRpe = lightBlockMode ? null : cycleInBlock === 1 ? 6 : cycleInBlock === 2 ? 7 : 8;
  // 하이브리드 연속일 AMRAP 가드: 직전 세션과의 간격(일). 미지정이면 보류하지 않음(기존 동작).
  const restDayGap = toNumberOrNull((effectiveParams as Record<string, unknown> | undefined)?.restDayGap);

  return items
    .map((item, index: number): PlannedExercise | null => {
      const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
      if (!exerciseName) return null;

      const rowType = normalizeManualRowType(
        item?.rowType ?? item?.slotRole ?? item?.meta?.rowType ?? item?.meta?.slotRole,
      );
      const progressionTarget =
        normalizeProgressionTarget(item?.progressionTarget ?? item?.meta?.progressionTarget) ??
        inferTargetFromExerciseName(exerciseName);
      const slot = item?.slot as
        | { coef: number; amrap: boolean; sessionKey: string }
        | null
        | undefined;

      // AUTO + 슬롯: 슬롯 흐름(coef·sets·reps·amrap)에 블록 사이클 계수를 곱해 처방.
      if (rowType === "AUTO" && slot && progressionTarget) {
        const setRows = Array.isArray(item?.sets) ? item.sets : [];
        const setCount = Math.max(1, setRows.length || 1);
        const reps = Math.max(1, Number(setRows[0]?.reps) || 1);
        const tm = resolveAsymptoteTm(progressionTarget, effectiveParams, defaults);
        const workingWeightKg =
          tm !== null ? floorToMultiple2p5(tm * cycleCoef * slot.coef) : null;
        const baseTag = `Asymptote C${cycleInBlock}${String(slot.sessionKey ?? "")}${lightBlockMode ? " · light" : ""}`;

        const sets: PlannedSet[] = Array.from({ length: setCount }, (_, setIdx) => {
          const isLastSet = setIdx === setCount - 1;
          const amrapEligible = isAmrapCycle && slot.amrap === true && isLastSet;
          const deferAmrap = asymptoteShouldDeferAmrap({ amrapEligible, restDayGap });
          const isAmrapSet = amrapEligible && !deferAmrap;
          const set: PlannedSet = {
            reps,
            percent: cycleCoef * slot.coef,
            amrap: isAmrapSet,
            note: isAmrapSet
              ? `${baseTag} · AMRAP ${reps}+`
              : deferAmrap
                ? `${baseTag} · AMRAP 보류(연속일) · 그라인딩 정지`
                : `${baseTag} · 그라인딩 정지`,
          };
          if (workingWeightKg !== null) set.targetWeightKg = workingWeightKg;
          if (cycleBaseRpe !== null && !isAmrapSet) set.rpe = cycleBaseRpe;
          if (!isAmrapSet) set.stopOnGrind = true;
          // v0.5.1 F3: 보류된 AMRAP 마킹 — LOGIC 경로와 동일 규칙.
          if (deferAmrap) set.meta = { amrapDeferred: true };
          return set;
        });
        // v0.5 프라이밍 탑세트 — LOGIC 경로(generateAsymptote)와 동일 규칙(§A.3: 두 경로 일치
        // 필수). 슬롯 스냅샷에는 topSet 메타가 없으므로 청사진(단일 진실원)에서 (sessionKey,
        // target)으로 파생 — 기존 저장 플랜에도 즉시 적용되고 스냅샷-청사진 drift가 불가능하다.
        const blueprintSession =
          ASYMPTOTE_SESSIONS[ASYMPTOTE_SESSION_NUMBER_BY_LABEL[String(slot.sessionKey ?? "")] ?? -1];
        const topSet = buildAsymptoteTopSet({
          spec: blueprintSession?.find((row) => row.target === progressionTarget)?.topSet,
          cycleInBlock,
          lightBlockMode,
          tm,
          cycleCoef,
          baseTag,
        });
        if (topSet) sets.unshift(topSet);

        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: "MAIN" as const,
          sourceBlockTarget: progressionTarget,
          order: toNumberOrNull(item?.order) ?? index,
          rowType: "AUTO" as const,
          progressionTarget,
          progressionKey: progressionTarget,
          sets,
        } satisfies PlannedExercise;
      }

      // CUSTOM(또는 슬롯 없는 행): 저장된 세트를 그대로 통과(수동).
      const setRows = Array.isArray(item?.sets) && item.sets.length > 0 ? item.sets : [item];
      return {
        exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
        exerciseName,
        role: item?.role === "ASSIST" ? "ASSIST" : "MAIN",
        sets: setRows.map(mapManualSet),
        sourceBlockTarget: progressionTarget ?? "CUSTOM",
        order: toNumberOrNull(item?.order) ?? index,
        rowType: rowType ?? "CUSTOM",
        progressionTarget: progressionTarget ?? null,
        progressionKey: null,
      } satisfies PlannedExercise;
    })
    .filter((exercise: PlannedExercise | null): exercise is PlannedExercise => Boolean(exercise));
}

// 531 슬롯형 커스터마이즈 처방. 세션의 각 item이 메인/보조(FSL·BBB) 슬롯을 들고 있고, generate531과
// 동일한 주차 메인 테이블(wendler531WeekSets)·보조 규칙을 입혀 처방한다. progressionKey=target(메인)으로
// reducer의 wendler-531 진행과 호환된다. 보조(ASSIST)는 진행 추적하지 않는다(progressionKey=null).
export function plannedExercisesFrom531ManualSession(
  manualSession: ManualSession | null,
  week: number,
  effectiveParams: PlanParams,
  defaults: ProgramDefaults,
): PlannedExercise[] {
  const items: ManualItem[] =
    manualSession && Array.isArray(manualSession.items) ? manualSession.items : [];
  const weekSets = wendler531WeekSets(week);
  const firstSetPercent = weekSets[0]?.percent ?? 0.65;

  return items
    .map((item, index: number): PlannedExercise | null => {
      const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
      if (!exerciseName) return null;

      const slot = item?.slot as { assistance?: string } | null | undefined;
      const assistance = String(slot?.assistance ?? "main").toLowerCase();
      const progressionTarget =
        normalizeProgressionTarget(item?.progressionTarget ?? item?.meta?.progressionTarget) ??
        inferTargetFromExerciseName(exerciseName);
      const tm = progressionTarget
        ? pickTrainingMaxKg(effectiveParams, defaults, progressionTarget)
        : null;

      // 보조: FSL(첫세트% 5×5) / BBB(TM50% 5×10). 진행 추적 안 함.
      if (assistance === "fsl" || assistance === "bbb") {
        const isFsl = assistance === "fsl";
        const setCount = isFsl ? WENDLER_531_FSL_SETS : WENDLER_531_BBB_SETS;
        const reps = isFsl ? WENDLER_531_FSL_REPS : WENDLER_531_BBB_REPS;
        const percent = isFsl ? firstSetPercent : WENDLER_531_BBB_PERCENT;
        const note = isFsl ? "FSL" : "BBB";
        const sets: PlannedSet[] = Array.from({ length: setCount }, () => {
          const set: PlannedSet = { reps, percent, note };
          if (tm !== null) set.targetWeightKg = roundToNearest2p5(tm * percent);
          return set;
        });
        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: "ASSIST" as const,
          skipProgression: true,
          sourceBlockTarget: progressionTarget ? `${progressionTarget}_${note}` : "ASSIST",
          order: toNumberOrNull(item?.order) ?? index,
          rowType: "AUTO" as const,
          progressionTarget: progressionTarget ?? null,
          progressionKey: null,
          sets,
        } satisfies PlannedExercise;
      }

      // 메인: 주차 메인 테이블 % (generate531과 동일하게 buildPercentSets 재사용 → 무게 일치).
      const sets: PlannedSet[] =
        tm !== null
          ? buildPercentSets(tm, weekSets)
          : weekSets.map((row) => ({
              reps: row.reps,
              percent: row.percent,
              amrap: row.amrap === true,
              note: row.note,
            }));
      return {
        exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
        exerciseName,
        role: "MAIN" as const,
        sourceBlockTarget: progressionTarget ?? "CUSTOM",
        order: toNumberOrNull(item?.order) ?? index,
        rowType: "AUTO" as const,
        progressionTarget: progressionTarget ?? null,
        progressionKey: progressionTarget,
        sets,
      } satisfies PlannedExercise;
    })
    .filter((exercise: PlannedExercise | null): exercise is PlannedExercise => Boolean(exercise));
}

// gzclp/texas 등 per-slot LP 슬롯형 커스터마이즈 처방. 각 item의 slot.progressionKey로 reducer가
// 굴린 슬롯별 workKg를 읽어 무게를 채우고(없으면 저장 무게 폴백), 저장 sets 구조(reps/AMRAP)는 유지한다.
// progressionKey=슬롯 키로 흘려보내 reducer per-slot 진행과 호환된다(같은 운동·다른 tier 독립).
// gzclp 정석 stage(v2)에서 강등 단계별 세트 스킴. stage 0은 저장 세트를 쓰므로 여기 없음.
// T1: 5×3 → 6×2 → 10×1, T2: 3×10 → 3×8 → 3×6 (인덱스 = stage).
function resolveGzclpStageScheme(
  effectiveParams: PlanParams,
  family: string | null | undefined,
  tier: string | undefined,
  slotKey: string,
): { setCount: number; reps: number } | null {
  if (family !== "gzclp") return null;
  if (effectiveParams?.progressionModel !== "v2") return null;
  if (tier !== "T1" && tier !== "T2") return null;
  const stage = Number(effectiveParams?.stageByKey?.[slotKey]) || 0;
  if (stage <= 0) return null;
  const schemes: Array<[number, number]> =
    tier === "T1" ? [[5, 3], [6, 2], [10, 1]] : [[3, 10], [3, 8], [3, 6]];
  const [setCount, reps] = schemes[Math.min(Math.floor(stage), 2)];
  return { setCount, reps };
}

// stage 변형 세트: 저장 첫 세트를 템플릿으로 setCount개를 reps로 펼친다(무게는 reducer workKg).
function buildGzclpStageSets(
  scheme: { setCount: number; reps: number },
  setRows: ManualSet[],
  effectiveKg: number | null,
): PlannedSet[] {
  const template = mapManualSet(setRows[0] ?? {});
  const out: PlannedSet[] = [];
  for (let i = 0; i < scheme.setCount; i += 1) {
    const base: PlannedSet = { ...template, reps: scheme.reps };
    if (effectiveKg !== null && effectiveKg > 0) base.targetWeightKg = effectiveKg;
    out.push(base);
  }
  return out;
}

export function plannedExercisesFromSlottedLpManualSession(
  // 엔진 ManualSession과 program-store fork draft(ManualDefinitionSession)가 모두
  // 흘러드는 WRITE/READ 교차 소비처라 unknown 경계에서 좁힌다(로컬타입 수렴 전까지).
  manualSession: unknown,
  effectiveParams: PlanParams,
  defaults: ProgramDefaults,
  family?: string | null,
): PlannedExercise[] {
  const session = (manualSession ?? null) as { items?: unknown; key?: unknown } | null;
  const items: ManualItem[] =
    session && Array.isArray(session.items) ? session.items : [];
  const sessionKey = String(session?.key ?? "").trim();
  return items
    .map((item, index: number): PlannedExercise | null => {
      const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
      if (!exerciseName) return null;

      // 원본(미-fork) 정의는 slot이 없다 → note/index에서 동적 생성(fork draft와 동일한 인덱스 진행키).
      let slot: { progressionKey?: string; startWeightKg?: number; tier?: string; texasRole?: string; driver?: boolean } | null =
        (item?.slot as { progressionKey?: string; startWeightKg?: number; tier?: string; texasRole?: string; driver?: boolean } | null) ?? null;
      if ((!slot || !slot.progressionKey) && family && sessionKey) {
        const firstSet = (Array.isArray(item?.sets) ? item.sets[0] : null) ?? {};
        const note = String(firstSet?.note ?? item?.note ?? "");
        const startW = Number(firstSet?.targetWeightKg) || 0;
        slot = buildSlottedLpSlot(note, family, sessionKey, index, startW);
      }
      const slotKey = slot?.progressionKey ? String(slot.progressionKey) : null;
      const rowType = normalizeManualRowType(
        item?.rowType ?? item?.slotRole ?? item?.meta?.rowType ?? item?.meta?.slotRole,
      );
      const progressionTarget =
        normalizeProgressionTarget(item?.progressionTarget ?? item?.meta?.progressionTarget) ??
        inferTargetFromExerciseName(exerciseName);

      const setRows = Array.isArray(item?.sets) && item.sets.length > 0 ? item.sets : [item];

      // CUSTOM 행 또는 슬롯 키 없음 → 저장 세트 그대로 통과(진행 추적 안 함).
      if (rowType === "CUSTOM" || !slotKey) {
        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: item?.role === "ASSIST" ? "ASSIST" : "MAIN",
          sets: setRows.map(mapManualSet),
          sourceBlockTarget: progressionTarget ?? "CUSTOM",
          order: toNumberOrNull(item?.order) ?? index,
          rowType: rowType ?? "CUSTOM",
          progressionTarget: progressionTarget ?? null,
          progressionKey: null,
        } satisfies PlannedExercise;
      }

      // AUTO 슬롯 무게: reducer workKg → 슬롯 시작무게 → 저장 세트 무게 순으로 폴백.
      const slotWorkKg = pickTrainingMaxKgByKeys(effectiveParams, defaults, [slotKey]);
      const startWeightKg =
        typeof slot?.startWeightKg === "number" && slot.startWeightKg > 0
          ? slot.startWeightKg
          : null;
      const effectiveKg = slotWorkKg !== null && slotWorkKg > 0 ? slotWorkKg : startWeightKg;

      // madcow/nsuns: 세트 무게를 슬롯 workKg(주간 탑세트 / TM)의 퍼센트로 파생한다.
      // 한 운동의 workKg를 여러 요일이 공유하므로, 진행 판정은 slot.driver 슬롯 하나만 맡고
      // 나머지 행은 무게만 파생한 뒤 skipProgression으로 reducer에서 빠진다(texas V/R과 동일 전략).
      if (usesPercentDerivedSets(family)) {
        const isDriver = slot?.driver === true;
        // 기준 무게 해석은 reducer와 같은 순서여야 한다(readTrainingMaxForKey: 슬롯 키 → family 키).
        // 프로그램 시작 화면은 1RM을 운동별이 아니라 family 키(SQUAT/BENCH/…)로 저장하므로,
        // 슬롯 키만 보면 첫 세션이 유저 입력 대신 seed 데모 무게로 처방된다.
        const percentBaseKg =
          pickTrainingMaxKgByKeys(effectiveParams, defaults, [slotKey, progressionTarget]) ??
          (typeof slot?.startWeightKg === "number" && slot.startWeightKg > 0
            ? slot.startWeightKg
            : null);
        const pctSets = setRows.map((s) => {
          const base = mapManualSet(s);
          const pct = toNumberOrNull(s?.percent);
          if (percentBaseKg !== null && percentBaseKg > 0) {
            base.targetWeightKg =
              pct !== null && pct > 0
                ? roundToNearest2p5(percentBaseKg * pct)
                : roundToNearest2p5(percentBaseKg);
          }
          // mapManualSet은 amrap을 보존하지 않는다. nsuns T1의 95% 세트만 판정 세트이므로
          // seed가 표시한 amrap을 그대로 흘려 reducer가 실측 reps로 TM 증가폭을 정한다.
          if (s?.amrap === true) base.amrap = true;
          return base;
        });
        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: "MAIN" as const,
          sets: pctSets,
          sourceBlockTarget: progressionTarget ?? "CUSTOM",
          order: toNumberOrNull(item?.order) ?? index,
          rowType: "AUTO" as const,
          progressionTarget: progressionTarget ?? null,
          progressionKey: isDriver ? slotKey : null,
          tier: null,
          stage: null,
          texasRole: null,
          skipProgression: isDriver ? undefined : true,
        } satisfies PlannedExercise;
      }

      // texas 주간(v2) 표시 역할 게이트.
      const isTexasV2 = family === "texas-method" && effectiveParams?.progressionModel === "v2";
      const txRole: "volume" | "recovery" | "intensity" | null =
        isTexasV2 &&
        (slot?.texasRole === "volume" || slot?.texasRole === "recovery" || slot?.texasRole === "intensity")
          ? slot.texasRole
          : null;
      // texas 주간(v2) V/R: 같은 target의 I workKg × 계수(볼륨 0.9 / 회복 0.8)로 무게를 파생한다.
      // progressionKey를 흘리지 않고 skipProgression으로 reducer 판정에서도 명시 제외한다.
      // I 무게가 오르면 다음 주 V/R도 자동으로 따라 오른다. I workKg가 아직 없으면 seed 무게 폴백.
      if (txRole === "volume" || txRole === "recovery") {
        const iKg = Number(effectiveParams?.texasIntensityByTarget?.[progressionTarget ?? ""]) || 0;
        const factor = txRole === "volume" ? 0.9 : 0.8;
        const derivedKg = iKg > 0 ? roundToNearest2p5(iKg * factor) : effectiveKg;
        const txSets = setRows.map((s) => {
          const base = mapManualSet(s);
          if (derivedKg !== null && derivedKg > 0) base.targetWeightKg = derivedKg;
          return base;
        });
        return {
          exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
          exerciseName,
          role: "MAIN" as const,
          sets: txSets,
          sourceBlockTarget: progressionTarget ?? "CUSTOM",
          order: toNumberOrNull(item?.order) ?? index,
          rowType: "AUTO" as const,
          progressionTarget: progressionTarget ?? null,
          progressionKey: null,
          tier: null,
          stage: null,
          texasRole: txRole,
          skipProgression: true,
        } satisfies PlannedExercise;
      }

      // gzclp v2 stage 변형: stage>0이면 tier별 강등 스킴(T1 6×2/10×1, T2 3×8/3×6)으로 세트 도출.
      // stage 0/비-v2는 저장 세트 그대로 → T2 비균일(3×10/3×8) seed 구조 보존.
      const stageScheme = resolveGzclpStageScheme(effectiveParams, family, slot?.tier, slotKey);
      // gzclp 정석(v2) T3: 마지막 세트는 AMRAP. reducer가 실측 reps≥25면 증량(plannedRef.amrap로 전달)
      // 한다. mapManualSet이 amrap을 버리므로 여기서 명시 주입한다. 비-v2/타 tier엔 부착하지 않는다
      // (forward-only — 기존 유저의 AMRAP 표시·진행 동작을 갑자기 바꾸지 않음).
      const isV2Gzclp = family === "gzclp" && effectiveParams?.progressionModel === "v2";
      const injectT3Amrap = isV2Gzclp && slot?.tier === "T3";
      // UI 배지용 표시 메타. tier=슬롯 계층, stage=T1/T2의 현재 강등 단계(reducer 파생, 0=기본).
      // T3는 stage 무의미(AMRAP)이므로 null. 비-v2/타 family는 전부 null이라 배지가 뜨지 않는다.
      const gzTier: "T1" | "T2" | "T3" | null =
        isV2Gzclp && (slot?.tier === "T1" || slot?.tier === "T2" || slot?.tier === "T3")
          ? slot.tier
          : null;
      const gzStage =
        gzTier === "T1" || gzTier === "T2" ? Number(effectiveParams?.stageByKey?.[slotKey]) || 0 : null;
      const sets: PlannedSet[] = stageScheme
        ? buildGzclpStageSets(stageScheme, setRows, effectiveKg)
        : setRows.map((s, sIdx: number) => {
            const base = mapManualSet(s);
            if (effectiveKg !== null && effectiveKg > 0) base.targetWeightKg = effectiveKg;
            if (injectT3Amrap && sIdx === setRows.length - 1) base.amrap = true;
            return base;
          });
      return {
        exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : null,
        exerciseName,
        role: "MAIN" as const,
        sets,
        sourceBlockTarget: progressionTarget ?? "CUSTOM",
        order: toNumberOrNull(item?.order) ?? index,
        rowType: "AUTO" as const,
        progressionTarget: progressionTarget ?? null,
        progressionKey: slotKey,
        tier: gzTier,
        stage: gzStage,
        texasRole: txRole,
      } satisfies PlannedExercise;
    })
    .filter((exercise: PlannedExercise | null): exercise is PlannedExercise => Boolean(exercise));
}

// manual 정의 → 레지스트리 엔트리(처방 플래너·무게 오버라이드 모드). operator 마커는 하위호환.
// slug를 함께 받아, 원본(미-fork) gzclp/texas처럼 정의에 programFamily가 없어도 slug로 레지스트리를
// 잡는다(fork는 family, 원본은 slug). 그래야 원본도 처방이 slotted-lp 라우팅을 탄다.
export function resolveManualEntry(
  manualDefinition: Record<string, unknown>,
  slug?: string | null,
): ProgramFamilyEntry | null {
  const familyHint =
    manualDefinition.operatorStyle === true
      ? "operator"
      : String(manualDefinition.programFamily ?? "");
  return lookupProgramFamily({
    family: familyHint,
    kind: String(manualDefinition.kind ?? ""),
    slug: slug ?? "",
  });
}

function plannedExercisesFromBlocks(
  snapshot: { blocks?: readonly LogicBlockSource[] },
  week: number,
  day: number,
  planParams: Record<string, unknown>,
) {
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
      // 병합 결과는 스키마 상 느슨한 bag이라 ctx 계약(PlanParams/ProgramDefaults)로 캐스트한다
      // (런타임 객체는 불변, 경계 캐스트 — Phase 2d-2와 동형).
      params: { ...(planParams ?? {}), ...(b?.params ?? {}) } as PlanParams,
      defaults: (b?.defaults ?? {}) as ProgramDefaults,
      forcedTarget,
      orderBase: i * 100,
    });
    exercises.push(...generated);
  }

  return exercises;
}

function reorderBlocks(blocks: SnapshotBlock[], order: string[]) {
  const map = new Map(blocks.map((b) => [b.target, b]));
  const reordered = order.map((k) => map.get(k)).filter((b): b is SnapshotBlock => Boolean(b));
  const remaining = blocks.filter((b) => !order.includes(b.target));
  return [...reordered, ...remaining];
}

function sortExercises(exercises: PlannedExercise[]) {
  return exercises
    .slice()
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

function applyOverridesToSnapshot(
  snapshot: SnapshotV3,
  overrides: ReadonlyArray<{ id: string; patch: unknown }>,
): SnapshotV3 {
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
      const tgt = p.target?.blockTarget;
      if (tgt && Array.isArray(snapshot.blocks)) {
        const block = snapshot.blocks.find((b) => b.target === tgt);
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
      const order = p.value?.order;
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
    snapshot.accessories.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }
  if (Array.isArray(snapshot.exercises)) {
    snapshot.exercises = sortExercises(snapshot.exercises);
  }

  return snapshot;
}

function pickManualSession(definition: unknown, sessionKey: string): ManualSession | null {
  if (!definition || (definition as { kind?: unknown }).kind !== "manual") return null;
  const def = definition as ManualDefinition;
  const sessions = Array.isArray(def.sessions) ? def.sessions : [];
  return sessions.find((s) => s.key === sessionKey) ?? null;
}

// texas 주간 모델(v2): I(강도일) 슬롯 workKg를 progressionTarget별로 모은다. I 슬롯키는 `I_s{n}`
// 규약(sessionKey "I"). 처방이 같은 target의 V/R 슬롯을 이 값×계수(0.9/0.8)로 파생하는 데 쓴다.
function extractTexasIntensityByTarget(runtimeState: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const targets =
    runtimeState && typeof runtimeState === "object" && !Array.isArray(runtimeState)
      ? (runtimeState as { targets?: unknown }).targets
      : null;
  if (!targets || typeof targets !== "object") return out;
  for (const [key, value] of Object.entries(targets as Record<string, unknown>)) {
    if (!/^I_s\d+$/.test(key)) continue;
    const tgt = (value as { progressionTarget?: unknown })?.progressionTarget;
    const wk = Number((value as { workKg?: unknown })?.workKg);
    if (typeof tgt === "string" && tgt && Number.isFinite(wk) && wk > 0) out[tgt] = wk;
  }
  return out;
}

function mergePlanParamsWithRuntimeState(planParams: unknown, runtimeState: unknown) {
  const baseParams = (planParams ?? {}) as Record<string, unknown>;
  const runtimeTrainingMax = extractTrainingMaxOverridesFromState(runtimeState);
  const runtimeRecord =
    runtimeState && typeof runtimeState === "object" && !Array.isArray(runtimeState)
      ? (runtimeState as Record<string, unknown>)
      : null;
  const runtimeLightBlockMode = runtimeRecord?.lightBlockMode === true;
  const runtimeStageByKey = extractStageOverridesFromState(runtimeState);
  const hasStageOverride = Object.keys(runtimeStageByKey).length > 0;
  // texas 주간 모델(v2): I 슬롯 workKg by target. 처방이 V/R = I×계수 파생에 쓴다.
  const texasIntensityByTarget =
    baseParams.progressionModel === "v2" ? extractTexasIntensityByTarget(runtimeState) : {};
  const hasTexasIntensity = Object.keys(texasIntensityByTarget).length > 0;

  const hasTmOverride = Object.keys(runtimeTrainingMax).length > 0;
  if (!hasTmOverride && !runtimeLightBlockMode && !hasStageOverride && !hasTexasIntensity) return baseParams;

  const existingTrainingMax =
    typeof baseParams.trainingMaxKg === "object" && baseParams.trainingMaxKg
      ? (baseParams.trainingMaxKg as Record<string, unknown>)
      : {};

  const next: Record<string, unknown> = { ...baseParams };
  if (hasTmOverride) {
    next.trainingMaxKg = {
      ...existingTrainingMax,
      ...runtimeTrainingMax,
    };
  }
  if (hasStageOverride) {
    const existingStage =
      typeof baseParams.stageByKey === "object" && baseParams.stageByKey
        ? (baseParams.stageByKey as Record<string, unknown>)
        : {};
    next.stageByKey = { ...existingStage, ...runtimeStageByKey };
  }
  if (runtimeLightBlockMode) {
    next.lightBlockMode = true;
  }
  if (hasTexasIntensity) {
    next.texasIntensityByTarget = texasIntensityByTarget;
  }
  return next;
}

// uniform LP(greyskull/SS/SL 등)의 처방 무게 채우기: reducer가 family 키로 굴린 workKg를
// 운동명→target 매핑으로 각 세트에 덮어쓴다. fork는 새 slug를 받으므로 slug가 아니라 레지스트리의
// weightOverrideMode("family-target")로 판정해야 fork 후에도 무게가 흐른다.
export function applyManualRuntimeWeightOverrides(
  entry: ProgramFamilyEntry | null,
  exercises: PlannedExercise[],
  runtimeState: unknown,
) {
  if (entry?.weightOverrideMode !== "family-target") return exercises;
  const runtimeTrainingMax = extractTrainingMaxOverridesFromState(runtimeState);
  if (Object.keys(runtimeTrainingMax).length < 1) return exercises;

  return exercises.map((exercise) => {
    // 진행에서 제외된 보조 행은 무게도 덮어쓰지 않는다. 운동명으로 family를 되짚는 방식이라
    // 그냥 두면 Romanian Deadlift가 데드리프트 작업중량을, Seated Row가 바벨로우 중량을 받는다.
    if (exercise.skipProgression === true) return exercise;
    const target = inferTargetFromExerciseName(exercise.exerciseName);
    if (!target) return exercise;
    const weight = runtimeTrainingMax[target];
    if (!Number.isFinite(weight) || weight <= 0) return exercise;
    return {
      ...exercise,
      sets: (exercise.sets ?? []).map((set) => ({
        ...set,
        targetWeightKg: weight,
      })),
    };
  });
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
// 하이브리드(Asymptote × Async) 연속일 AMRAP 가드용 restDayGap: 생성 중인 세션 날짜와 직전 수행
// 세션(같은 플랜) 사이의 일 간격(plan timezone 기준). 직전 세션 없음/조회 실패면 null(가드 비활성).
async function resolveRestDayGapDays(input: {
  planId: string;
  sessionDate: string;
  timezone: string;
}): Promise<number | null> {
  try {
    const tz = input.timezone || "UTC";
    const rows = await db
      .select({
        lastDate: sql<string | null>`max((${workoutLog.performedAt} at time zone ${tz})::date)::text`,
      })
      .from(workoutLog)
      .where(eq(workoutLog.planId, input.planId));
    return asymptoteDayGap(input.sessionDate, rows[0]?.lastDate ?? null);
  } catch {
    return null;
  }
}

export type GenerateSessionInput = {
  userId: string;
  planId: string;
  week?: number;
  day?: number;
  sessionDate?: string;
  timezone?: string;
  /** REF5 is generated from an exact first-work-set start, never a date bucket. */
  ref5?: {
    protocolVersion: "1.2";
    actualStartAt: string;
    todayBodyweightKg: number;
    manualMicro: boolean;
    startEventId: string;
  };
};

async function buildSession(
  input: GenerateSessionInput,
  persist: boolean,
) {
  // plan + runtimeState 병렬 조회 (기존 2-round-trip → 1-round-trip)
  const [pRows, runtimeRows] = await Promise.all([
    db.select().from(planTable).where(eq(planTable.id, input.planId)).limit(1),
    db
      .select({ state: planRuntimeState.state })
      .from(planRuntimeState)
      .where(eq(planRuntimeState.planId, input.planId))
      .limit(1),
  ]);
  const p = pRows[0];
  if (!p) throw new Error("Plan not found");
  if (p.userId !== input.userId) throw new Error("Forbidden");

  // REF5 owns exact-time generation, snapshot immutability, and the first-SQ
  // start transition. It must not pass through cycle/week/TM/override logic.
  if (isRef5PlanParams(p.params)) {
    return buildRef5PlanSession(input, persist);
  }

  const runtimeState = runtimeRows[0]?.state ?? null;
  const effectivePlanParams = mergePlanParamsWithRuntimeState(p.params ?? {}, runtimeState);

  const sessionCtx = deriveSessionContext({
    plan: {
      ...p,
      params: effectivePlanParams,
    },
    week: input.week,
    day: input.day,
    sessionDate: input.sessionDate,
    timezone: input.timezone,
    runtimeState,
  });
  const sessionKey = sessionCtx.sessionKey;

  // 하이브리드 연속일 AMRAP 가드 입력. asymptote 처방만 소비하며, 값이 없으면 가드 비활성
  // (다른 프로그램·preview 경로 동작 불변). 세션 생성은 유저 액션이라 단건 인덱스 조회 1회는 무해.
  const restDayGap = await resolveRestDayGapDays({
    planId: input.planId,
    sessionDate: sessionCtx.sessionDate,
    timezone: sessionCtx.timezone,
  });
  if (restDayGap !== null) {
    (effectivePlanParams as Record<string, unknown>).restDayGap = restDayGap;
  }

  // overrides + (modules 또는 version/template) 병렬 조회
  let snapshot: SnapshotV3 = {
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
    const [overrides, modules] = await Promise.all([
      db
        .select()
        .from(planOverride)
        .where(
          and(
            eq(planOverride.planId, p.id),
            eq(planOverride.scope, "SESSION"),
            eq(planOverride.sessionKey, sessionKey),
          ),
        ),
      db.select().from(planModule).where(eq(planModule.planId, p.id)),
    ]);

    const versionIds = Array.from(new Set(modules.map((m) => m.programVersionId).filter((id): id is string => Boolean(id))));
    const versionsWithTemplates = versionIds.length > 0
      ? await db
          .select({
            version: programVersion,
            template: programTemplate,
          })
          .from(programVersion)
          .innerJoin(programTemplate, eq(programVersion.templateId, programTemplate.id))
          .where(inArray(programVersion.id, versionIds))
      : [];

    const versionMap = new Map(versionsWithTemplates.map((row) => [row.version.id, row]));

    const blocks = modules
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((m) => {
        if (!m.programVersionId) throw new Error("Program version not found");
        const row = versionMap.get(m.programVersionId);
        if (!row) throw new Error("Program version/template not found");
        const { version, template } = row;

        return {
          target: m.target,
          program: {
            slug: template.slug,
            name: template.name,
            type: template.type,
            version: version.version,
          },
          definition: version.definition,
          defaults: (version.defaults ?? {}) as Record<string, unknown>,
          params: (m.params ?? {}) as Record<string, unknown>,
        } satisfies SnapshotBlock;
      });

    snapshot.blocks = blocks;
    snapshot.exercises = plannedExercisesFromBlocks(
      snapshot,
      sessionCtx.week,
      sessionCtx.day,
      effectivePlanParams,
    );
    snapshot = applyOverridesToSnapshot(snapshot, overrides);
  } else {
    if (!p.rootProgramVersionId) throw new Error("rootProgramVersionId missing");

    // overrides + version/template 병렬 조회
    const [overrides, rows] = await Promise.all([
      db
        .select()
        .from(planOverride)
        .where(
          and(
            eq(planOverride.planId, p.id),
            eq(planOverride.scope, "SESSION"),
            eq(planOverride.sessionKey, sessionKey),
          ),
        ),
      db
        .select({
          version: programVersion,
          template: programTemplate,
        })
        .from(programVersion)
        .innerJoin(programTemplate, eq(programVersion.templateId, programTemplate.id))
        .where(eq(programVersion.id, p.rootProgramVersionId))
        .limit(1),
    ]);
    const row = rows[0];
    if (!row) throw new Error("Program version/template not found");
    const { version, template } = row;

    if (p.type === "MANUAL") {
      const schedule = Array.isArray(effectivePlanParams.schedule)
        ? effectivePlanParams.schedule
        : [];
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
        const manualDefinition = (version.definition ?? {}) as Record<string, unknown>;
        const manualEntry = resolveManualEntry(manualDefinition, template.slug);
        const manualPlanner = manualEntry?.manualPlanner ?? "generic";
        if (manualPlanner === "operator") {
          snapshot.exercises = plannedExercisesFromOperatorManualSession(
            snapshot.manualSession,
            sessionCtx.week,
            effectivePlanParams,
            (p.params ?? {}) as PlanParams,
            (version.defaults ?? {}) as ProgramDefaults,
          );
        } else if (manualPlanner === "asymptote") {
          snapshot.exercises = plannedExercisesFromAsymptoteManualSession(
            snapshot.manualSession,
            sessionCtx.week,
            effectivePlanParams,
            (version.defaults ?? {}) as ProgramDefaults,
          );
        } else if (manualPlanner === "wendler-531") {
          snapshot.exercises = plannedExercisesFrom531ManualSession(
            snapshot.manualSession,
            sessionCtx.week,
            effectivePlanParams,
            (version.defaults ?? {}) as ProgramDefaults,
          );
        } else if (manualPlanner === "slotted-lp") {
          snapshot.exercises = plannedExercisesFromSlottedLpManualSession(
            snapshot.manualSession,
            effectivePlanParams,
            (version.defaults ?? {}) as ProgramDefaults,
            manualEntry?.family,
          );
        } else {
          const injectGreyskullAmrap =
            manualEntry?.family === "greyskull-lp" &&
            (effectivePlanParams as Record<string, unknown>)?.progressionModel === "v2";
          const enforceUniformLpReps =
            (manualEntry?.family === "starting-strength-lp" ||
              manualEntry?.family === "stronglifts-5x5" ||
              manualEntry?.family === "reddit-ppl" ||
              manualEntry?.family === "phul") &&
            (effectivePlanParams as Record<string, unknown>)?.progressionModel === "v2";
          snapshot.exercises = applyManualRuntimeWeightOverrides(
            manualEntry,
            plannedExercisesFromManualSession(snapshot.manualSession, {
              injectAmrapLastMainSet: injectGreyskullAmrap,
              enforcePlannedReps: enforceUniformLpReps,
            }),
            runtimeState,
          );
        }
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
          defaults: (version.defaults ?? {}) as Record<string, unknown>,
          params: effectivePlanParams,
        },
      ];
      snapshot.exercises = plannedExercisesFromBlocks(
        snapshot,
        sessionCtx.week,
        sessionCtx.day,
        effectivePlanParams,
      );
      snapshot = applyOverridesToSnapshot(snapshot, overrides);
    }
  }

  // v0.5.1 F3·F4: 세션 수준 피드백 메타 승격 — UI가 세트를 뒤지지 않고 배너/배지를 판단한다.
  // amrapDeferred = 처방 세트 중 보류된 AMRAP 존재(F3 배너), lightBlockMode = 이번 세션이
  // 라이트(회복) 계수로 처방됨(F4 배지). 둘 다 표식일 뿐 판정 로직은 읽지 않는다.
  if (plannedExercisesHaveDeferredAmrap(snapshot.exercises)) snapshot.amrapDeferred = true;
  if ((effectivePlanParams as Record<string, unknown>)?.lightBlockMode === true) {
    snapshot.lightBlockMode = true;
  }

  // 홈 미리보기처럼 읽기 전용 호출은 동일 처방 로직을 쓰되 generated_session을
  // 갱신하지 않는다. 화면 렌더가 DB mutation을 일으키지 않도록 경계를 분리한다.
  if (!persist) return { snapshot };

  // 원자적 upsert: (plan_id, session_key) 유니크 제약 기준 INSERT-or-UPDATE.
  // 기존 SELECT→UPDATE/INSERT는 비트랜잭션이라 동시 렌더가 둘 다 SELECT 미스 후
  // INSERT하면 유니크 위반으로 렌더가 실패할 수 있었다(레이스). DO UPDATE가 항상
  // 실행돼 RETURNING이 늘 row를 반환하므로 반환값도 안전. 렌더마다 큰 snapshot을
  // 읽어오던 full-row SELECT도 제거된다.
  const [saved] = await db
    .insert(generatedSession)
    .values({
      planId: p.id,
      userId: input.userId,
      sessionKey,
      snapshot,
    })
    .onConflictDoUpdate({
      target: [generatedSession.planId, generatedSession.sessionKey],
      set: { snapshot, updatedAt: new Date() },
    })
    .returning();

  return saved;
}

/** DB write 없이 현재 런타임 위치의 세션 스냅샷을 계산한다. */
export async function generateSessionSnapshot(input: GenerateSessionInput) {
  const generated = await buildSession(input, false);
  return generated.snapshot;
}

/** 운동 시작/명시적 생성 흐름에서 세션 스냅샷을 원자적으로 저장한다. */
export async function generateAndSaveSession(input: GenerateSessionInput) {
  const generated = await buildSession(input, true);
  if (!("id" in generated)) {
    throw new Error("Generated session was not persisted");
  }
  return generated;
}

export type PreviewSessionInput = {
  planType: "SINGLE" | "COMPOSITE" | "MANUAL";
  planParams: unknown;
  runtimeState: unknown;
  rootVersion?: { definition: unknown; defaults?: unknown } | null;
  rootTemplateSlug?: string | null;
  modules?: Array<{
    target: string;
    params: unknown;
    version: { definition: unknown; defaults?: unknown };
    templateSlug?: string;
  }>;
  week: number;
  day: number;
};

/**
 * DB write 없이 메모리에서 세션의 운동 미리보기를 계산.
 * generateAndSaveSession의 snapshot 생성 로직을 재사용하지만 overrides는 미적용.
 * 사이클 전체 흐름을 시각화할 때 18개 세션을 한 번에 계산하기 위한 용도.
 */
export function previewSessionExercises(
  input: PreviewSessionInput,
): PlannedExercise[] {
  const effectivePlanParams = mergePlanParamsWithRuntimeState(
    input.planParams,
    input.runtimeState,
  );

  if (input.planType === "COMPOSITE") {
    if (!input.modules || input.modules.length === 0) return [];
    const blocks = input.modules.map((m) => ({
      target: m.target,
      definition: m.version.definition,
      defaults: (m.version.defaults ?? {}) as Record<string, unknown>,
      params: (m.params ?? {}) as Record<string, unknown>,
    } satisfies LogicBlockSource));
    return plannedExercisesFromBlocks(
      { blocks },
      input.week,
      input.day,
      effectivePlanParams,
    );
  }

  if (!input.rootVersion) return [];

  if (input.planType === "MANUAL") {
    const schedule = Array.isArray(
      (effectivePlanParams as Record<string, unknown> | null)?.schedule,
    )
      ? ((effectivePlanParams as Record<string, unknown>).schedule as unknown[])
      : [];
    if (schedule.length === 0) return [];
    const chosenKey =
      schedule[input.day - 1] ??
      schedule[(input.day - 1) % schedule.length];
    if (typeof chosenKey !== "string" || !chosenKey) return [];

    const manualSession = pickManualSession(
      input.rootVersion.definition,
      chosenKey,
    );
    if (!manualSession) return [];

    const manualDefinition =
      (input.rootVersion.definition ?? {}) as Record<string, unknown>;
    const manualEntry = resolveManualEntry(manualDefinition, input.rootTemplateSlug);
    const manualPlanner = manualEntry?.manualPlanner ?? "generic";

    let exercises: PlannedExercise[];
    if (manualPlanner === "operator") {
      exercises = plannedExercisesFromOperatorManualSession(
        manualSession,
        input.week,
        effectivePlanParams,
        (input.planParams ?? {}) as PlanParams,
        (input.rootVersion.defaults ?? {}) as ProgramDefaults,
      );
    } else if (manualPlanner === "asymptote") {
      exercises = plannedExercisesFromAsymptoteManualSession(
        manualSession,
        input.week,
        effectivePlanParams,
        (input.rootVersion.defaults ?? {}) as ProgramDefaults,
      );
    } else if (manualPlanner === "wendler-531") {
      exercises = plannedExercisesFrom531ManualSession(
        manualSession,
        input.week,
        effectivePlanParams,
        (input.rootVersion.defaults ?? {}) as ProgramDefaults,
      );
    } else if (manualPlanner === "slotted-lp") {
      exercises = plannedExercisesFromSlottedLpManualSession(
        manualSession,
        effectivePlanParams,
        (input.rootVersion.defaults ?? {}) as ProgramDefaults,
        manualEntry?.family,
      );
    } else {
      const injectGreyskullAmrap =
        manualEntry?.family === "greyskull-lp" &&
        (effectivePlanParams as Record<string, unknown>)?.progressionModel === "v2";
      const enforceUniformLpReps =
        (manualEntry?.family === "starting-strength-lp" ||
          manualEntry?.family === "stronglifts-5x5" ||
          manualEntry?.family === "reddit-ppl" ||
          manualEntry?.family === "phul") &&
        (effectivePlanParams as Record<string, unknown>)?.progressionModel === "v2";
      exercises = plannedExercisesFromManualSession(manualSession, {
        injectAmrapLastMainSet: injectGreyskullAmrap,
        enforcePlannedReps: enforceUniformLpReps,
      });
      exercises = applyManualRuntimeWeightOverrides(
        manualEntry,
        exercises,
        input.runtimeState,
      );
    }

    return exercises;
  }

  const blocks = [
    {
      target: "CUSTOM",
      definition: input.rootVersion.definition,
      defaults: (input.rootVersion.defaults ?? {}) as Record<string, unknown>,
      params: effectivePlanParams,
    } satisfies LogicBlockSource,
  ];
  return plannedExercisesFromBlocks(
    { blocks },
    input.week,
    input.day,
    effectivePlanParams,
  );
}
