export type ProgramTemplate = {
  id: string;
  slug: string;
  name: string;
  type: "LOGIC" | "MANUAL";
  visibility: "PUBLIC" | "PRIVATE";
  description: string | null;
  tags: string[] | null;
  latestVersion: {
    id: string;
    version: number;
    definition: any;
    defaults: any;
  } | null;
};

export type ProgramListItem = {
  key: string;
  source: "MARKET" | "CUSTOM";
  name: string;
  subtitle: string;
  description: string;
  template: ProgramTemplate;
};

export type OneRmTarget = {
  key: string;
  label: string;
  fallbackKey?: string | null;
};

export type ProgramExerciseMode = "MARKET" | "MANUAL";
export type ProgramRowType = "AUTO" | "CUSTOM";
export type ProgramProgressionTarget = "SQUAT" | "BENCH" | "DEADLIFT" | "OHP" | "PULL";
export type ProgramSetRepDefaults = { sets: number; reps: number };

export type ProgramExerciseDraft = {
  id: string;
  exerciseName: string;
  mode: ProgramExerciseMode;
  marketTemplateSlug: string | null;
  rowType?: ProgramRowType | null;
  progressionTarget?: ProgramProgressionTarget | null;
  sets: number;
  reps: number;
  note: string;
};

export type ProgramSessionDraft = {
  id: string;
  key: string;
  exercises: ProgramExerciseDraft[];
};

export type SessionRuleType = "AB" | "NUMERIC";

export type SessionRule = {
  type: SessionRuleType;
  count: number;
};

type ManualDefinitionSession = {
  key: string;
  name: string;
  items: Array<{
    exerciseName: string;
    role: "MAIN" | "ASSIST";
    rowType?: ProgramRowType;
    progressionTarget?: ProgramProgressionTarget;
    slotRole?: "ANCHOR" | "FLEX" | "CUSTOM";
    sets: Array<{
      setNumber: number;
      reps: number;
      targetWeightKg: number;
      note?: string;
    }>;
  }>;
};

function isProgramRowType(value: unknown): value is ProgramRowType {
  return value === "AUTO" || value === "CUSTOM";
}

function normalizeProgramRowType(value: unknown): ProgramRowType | null {
  if (isProgramRowType(value)) return value;
  if (value === "ANCHOR" || value === "FLEX") return "AUTO";
  if (value === "CUSTOM") return "CUSTOM";
  return null;
}

export function isOperatorAutoRowType(rowType: ProgramRowType | null | undefined) {
  return rowType === "AUTO";
}

function isProgramProgressionTarget(value: unknown): value is ProgramProgressionTarget {
  return value === "SQUAT" || value === "BENCH" || value === "DEADLIFT" || value === "OHP" || value === "PULL";
}

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function defaultExerciseNameForTarget(targetRaw: string) {
  const target = String(targetRaw).trim().toUpperCase();
  if (target === "SQUAT") return "Back Squat";
  if (target === "BENCH") return "Bench Press";
  if (target === "DEADLIFT") return "Deadlift";
  if (target === "OHP") return "Overhead Press";
  if (target === "PULL") return "Pull-Up";
  return targetRaw || "Exercise";
}

export function inferProgressionTargetFromExerciseName(exerciseName: string): ProgramProgressionTarget | null {
  const normalized = String(exerciseName).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("squat")) return "SQUAT";
  if (normalized.includes("bench")) return "BENCH";
  if (normalized.includes("deadlift")) return "DEADLIFT";
  if (normalized.includes("overhead press") || normalized === "ohp" || normalized.includes("shoulder press")) {
    return "OHP";
  }
  if (
    normalized.includes("row") ||
    normalized.includes("pull-up") ||
    normalized.includes("pull up") ||
    normalized.includes("pulldown")
  ) {
    return "PULL";
  }
  return null;
}

function normalizeProgressionTarget(value: unknown): ProgramProgressionTarget | null {
  if (isProgramProgressionTarget(value)) return value;
  return inferProgressionTargetFromExerciseName(String(value ?? ""));
}

export function toProgramListItems(templates: ProgramTemplate[]): ProgramListItem[] {
  return templates
    .map((template) => {
      const source: ProgramListItem["source"] = template.visibility === "PUBLIC" ? "MARKET" : "CUSTOM";
      const subtitle = source === "MARKET" ? "시중 프로그램" : "사용자 커스터마이징";
      const fallbackDesc =
        source === "MARKET"
          ? "시중 프로그램 라이브러리에서 제공되는 기본 템플릿입니다."
          : "사용자가 생성/커스터마이징한 프로그램입니다.";
      const tagsText = Array.isArray(template.tags) && template.tags.length > 0 ? `태그: ${template.tags.join(", ")}` : "";
      const versionText = template.latestVersion ? `v${template.latestVersion.version}` : "버전 없음";
      const description = [template.description ?? "", tagsText, versionText].filter(Boolean).join(" / ") || fallbackDesc;

      return {
        key: `${source.toLowerCase()}-${template.id}`,
        source,
        name: template.name,
        subtitle,
        description,
        template,
      };
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "MARKET" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function getProgramScheduleLabel(template: ProgramTemplate): string {
  const def = template.latestVersion?.definition;
  if (!def) return "";

  if (def.kind === "operator") {
    const parts: string[] = [];
    const sessionsPerWeek = def.schedule?.sessionsPerWeek;
    const weeks = def.schedule?.weeks;
    if (sessionsPerWeek) parts.push(`주 ${sessionsPerWeek}회`);
    if (weeks) parts.push(`${weeks}주 사이클`);
    return parts.join(" · ");
  }

  if (def.kind === "manual" && Array.isArray(def.sessions) && def.sessions.length > 0) {
    const keys = (def.sessions as Array<{ key: string }>).map((s) => s.key).join("/");
    return `${def.sessions.length}분할 · ${keys}`;
  }

  return "";
}

export type ProgramStatItem = {
  label: string;
  value: string;
};

export type ProgramSessionBreakdown = {
  key: string;
  exercises: Array<{ name: string; setsReps: string; hasAmrap: boolean }>;
};

export type ProgramDetailInfo = {
  scheduleLabel: string;
  stats: ProgramStatItem[];
  sessions: ProgramSessionBreakdown[] | null;
  modules: string[] | null;
  progressionNote: string | null;
};

export function getProgramDetailInfo(template: ProgramTemplate): ProgramDetailInfo {
  const def = template.latestVersion?.definition;
  const defaults = template.latestVersion?.defaults;
  const tags = Array.isArray(template.tags) ? template.tags : [];

  let difficultyValue = "일반";
  if (tags.some((t) => t === "novice" || t === "beginner")) difficultyValue = "초급";
  else if (tags.some((t) => t === "intermediate")) difficultyValue = "중급";
  else if (tags.some((t) => t === "advanced")) difficultyValue = "고급";

  const typeValue = template.type === "LOGIC" ? "자동 진행" : "세션 고정";

  if (!def) {
    return {
      scheduleLabel: "",
      stats: [
        { label: "난이도", value: difficultyValue },
        { label: "방식", value: typeValue },
      ],
      sessions: null,
      modules: null,
      progressionNote: null,
    };
  }

  if (def.kind === "operator") {
    const sessionsPerWeek = def.schedule?.sessionsPerWeek as number | undefined;
    const weeks = def.schedule?.weeks as number | undefined;
    const parts: string[] = [];
    if (sessionsPerWeek) parts.push(`주 ${sessionsPerWeek}회`);
    if (weeks) parts.push(`${weeks}주 사이클`);

    const stats: ProgramStatItem[] = [
      { label: "난이도", value: difficultyValue },
      { label: "주간 빈도", value: sessionsPerWeek ? `주 ${sessionsPerWeek}회` : "-" },
      { label: "사이클", value: weeks ? `${weeks}주` : "-" },
      { label: "방식", value: typeValue },
    ];

    const modules = Array.isArray(def.modules) ? (def.modules as string[]) : null;

    const tmPercent = typeof defaults?.tmPercent === "number" ? Math.round(defaults.tmPercent * 100) : null;
    const mainSets = def.progression?.mainSets as number | undefined;
    const progressionParts: string[] = [];
    if (tmPercent) progressionParts.push(`TM ${tmPercent}%`);
    if (mainSets) progressionParts.push(`메인 ${mainSets}세트`);

    return {
      scheduleLabel: parts.join(" · "),
      stats,
      sessions: null,
      modules,
      progressionNote: progressionParts.join(" · ") || null,
    };
  }

  if (def.kind === "manual" && Array.isArray(def.sessions)) {
    type RawSet = { reps?: number; note?: string };
    type RawItem = { exerciseName: string; sets?: RawSet[] };
    type RawSession = { key: string; items?: RawItem[] };

    const rawSessions = def.sessions as RawSession[];
    const sessions: ProgramSessionBreakdown[] = rawSessions.map((session) => ({
      key: session.key,
      exercises: (session.items ?? []).map((item) => {
        const sets = item.sets ?? [];
        const setCount = sets.length;
        const firstReps = sets[0]?.reps;
        const hasAmrap = sets.some((s) => String(s.note ?? "").toUpperCase().includes("AMRAP"));
        const setsReps =
          setCount > 0 && firstReps != null
            ? `${setCount}×${firstReps}${hasAmrap ? "+" : ""}`
            : setCount > 0
              ? `${setCount}세트`
              : "";
        return { name: item.exerciseName, setsReps, hasAmrap };
      }),
    }));

    const sessionCount = sessions.length;
    const scheduleLabel =
      sessionCount > 0 ? `${sessionCount}분할 · ${sessions.map((s) => s.key).join("/")}` : "";

    const stats: ProgramStatItem[] = [
      { label: "난이도", value: difficultyValue },
      { label: "분할", value: sessionCount > 0 ? `${sessionCount}분할` : "-" },
      { label: "기간", value: "무제한" },
      { label: "방식", value: typeValue },
    ];

    return { scheduleLabel, stats, sessions, modules: null, progressionNote: null };
  }

  return {
    scheduleLabel: "",
    stats: [
      { label: "난이도", value: difficultyValue },
      { label: "방식", value: typeValue },
    ],
    sessions: null,
    modules: null,
    progressionNote: null,
  };
}

function normalizeTargets(definition: any): string[] {
  const raw = [
    ...(Array.isArray(definition?.lifts) ? definition.lifts : []),
    ...(Array.isArray(definition?.modules) ? definition.modules : []),
    ...(Array.isArray(definition?.mainLifts) ? definition.mainLifts : []),
    ...(Array.isArray(definition?.cluster) ? definition.cluster : []),
    ...(Array.isArray(definition?.progression?.dayMap) ? definition.progression.dayMap : []),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const unique: string[] = [];
  for (const target of raw) {
    if (!unique.includes(target)) unique.push(target);
  }
  return unique;
}

function canonicalTarget(raw: string) {
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("SQUAT")) return "SQUAT";
  if (normalized.includes("BENCH")) return "BENCH";
  if (normalized.includes("DEADLIFT") || normalized === "DEAD") return "DEADLIFT";
  if (normalized.includes("OHP") || normalized.includes("OVERHEAD") || normalized.includes("PRESS")) return "OHP";
  if (normalized.includes("PULL") || normalized.includes("ROW")) return "PULL";
  return normalized;
}

function targetLabel(target: string) {
  const canonical = canonicalTarget(target);
  if (canonical === "SQUAT") return "Back Squat";
  if (canonical === "BENCH") return "Bench Press";
  if (canonical === "DEADLIFT") return "Deadlift";
  if (canonical === "OHP") return "Overhead Press";
  if (canonical === "PULL") return "Pull-Up / Row";
  return defaultExerciseNameForTarget(canonical || target);
}

export function isOperatorTemplate(template: ProgramTemplate | null | undefined) {
  if (!template) return false;
  const slug = String(template.slug ?? "").trim().toLowerCase();
  const kind = String(template.latestVersion?.definition?.kind ?? "").trim().toLowerCase();
  return (
    slug === "operator" ||
    kind === "operator" ||
    template.latestVersion?.definition?.operatorStyle === true ||
    String(template.latestVersion?.definition?.programFamily ?? "").trim().toLowerCase() === "operator"
  );
}

function manualExerciseKey(exerciseName: string) {
  return `EX_${exerciseName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)}`;
}

function oneRmTargetsFromManualDefinition(definition: any): OneRmTarget[] {
  if (definition?.kind !== "manual" || !Array.isArray(definition.sessions)) return [];
  const operatorStyle = definition?.operatorStyle === true || String(definition?.programFamily ?? "").trim().toLowerCase() === "operator";
  const out: OneRmTarget[] = [];
  for (const session of definition.sessions) {
    const items = Array.isArray(session?.items) ? session.items : [];
    for (const item of items) {
      const rowType =
        normalizeProgramRowType(item?.rowType) ??
        normalizeProgramRowType(item?.slotRole) ??
        normalizeProgramRowType(item?.meta?.rowType) ??
        normalizeProgramRowType(item?.meta?.slotRole);
      if (operatorStyle && !isOperatorAutoRowType(rowType)) continue;
      const exerciseName = String(item?.exerciseName ?? item?.name ?? "").trim();
      if (!exerciseName) continue;
      if (operatorStyle) {
        const key = manualExerciseKey(exerciseName);
        if (!out.some((entry) => entry.key === key)) {
          out.push({
            key,
            label: exerciseName,
            fallbackKey: normalizeProgressionTarget(item?.progressionTarget) ?? inferProgressionTargetFromExerciseName(exerciseName),
          });
        }
        continue;
      }
      const inferred = inferProgressionTargetFromExerciseName(exerciseName);
      const key = inferred ? inferred : manualExerciseKey(exerciseName);
      const label = inferred ? targetLabel(inferred) : exerciseName;
      if (!out.some((entry) => entry.key === key)) {
        out.push({ key, label });
      }
    }
  }
  return out;
}

export function extractOneRmTargetsFromTemplate(template: ProgramTemplate): OneRmTarget[] {
  const definition = template.latestVersion?.definition ?? {};
  const fromLogic: OneRmTarget[] = normalizeTargets(definition)
    .map(canonicalTarget)
    .filter(Boolean)
    .map((key) => ({ key, label: targetLabel(key) }));
  const fromManual = oneRmTargetsFromManualDefinition(definition);
  const merged: OneRmTarget[] = [];
  for (const target of [...fromLogic, ...fromManual]) {
    if (!merged.some((entry) => entry.key === target.key)) {
      merged.push(target);
    }
  }

  if (String(definition?.kind ?? "").trim().toLowerCase() === "operator") {
    const hasPull = merged.some((entry) => entry.key === "PULL");
    if (!hasPull) {
      merged.push({ key: "PULL", label: targetLabel("PULL") });
    }
  }

  if (merged.length > 0) return merged;
  const fallback = template.type === "LOGIC" ? ["SQUAT", "BENCH", "DEADLIFT"] : ["SQUAT"];
  return fallback.map((key) => ({ key, label: targetLabel(key) }));
}

function sessionDraftFromManual(session: any): ProgramSessionDraft {
  const key = String(session?.key ?? "").trim() || "A";
  const items = Array.isArray(session?.items) ? session.items : [];
  return {
    id: uid("session"),
    key,
    exercises: items.map((item: any, index: number) => {
      const sets = Array.isArray(item?.sets) ? item.sets : [];
      const first = sets[0] ?? {};
      return {
        id: uid(`exercise-${index + 1}`),
        exerciseName: String(item?.exerciseName ?? item?.name ?? "").trim() || `Exercise ${index + 1}`,
        mode: "MANUAL" as const,
        marketTemplateSlug: null,
        rowType:
          normalizeProgramRowType(item?.rowType) ??
          normalizeProgramRowType(item?.slotRole) ??
          normalizeProgramRowType(item?.meta?.rowType) ??
          normalizeProgramRowType(item?.meta?.slotRole),
        progressionTarget:
          normalizeProgressionTarget(item?.progressionTarget) ??
          normalizeProgressionTarget(item?.meta?.progressionTarget) ??
          inferProgressionTargetFromExerciseName(String(item?.exerciseName ?? item?.name ?? "")),
        sets: Math.max(1, sets.length || Number(item?.setsCount) || 1),
        reps: Math.max(1, Number(first?.reps) || Number(item?.reps) || 5),
        note: typeof first?.note === "string" ? first.note : "",
      };
    }),
  };
}

function createFixedExerciseDraft(
  exerciseName: string,
  rowType: ProgramRowType,
  progressionTarget: ProgramProgressionTarget | null,
  sets = 3,
  reps = 5,
): ProgramExerciseDraft {
  return {
    id: uid("exercise"),
    exerciseName,
    mode: "MANUAL",
    marketTemplateSlug: null,
    rowType,
    progressionTarget,
    sets,
    reps,
    note: "",
  };
}

export function resolveOperatorExerciseDefaults(
  exerciseName: string,
  rowType: ProgramRowType | null | undefined,
): ProgramSetRepDefaults {
  if (rowType === "CUSTOM") {
    return { sets: 3, reps: 8 };
  }

  return { sets: 3, reps: 5 };
}

function operatorSessionDrafts(): ProgramSessionDraft[] {
  return [
    {
      id: uid("session"),
      key: "D1",
      exercises: [
        createFixedExerciseDraft("Back Squat", "AUTO", "SQUAT"),
        createFixedExerciseDraft("Bench Press", "AUTO", "BENCH"),
        createFixedExerciseDraft("Pull-Up", "AUTO", "PULL"),
      ],
    },
    {
      id: uid("session"),
      key: "D2",
      exercises: [
        createFixedExerciseDraft("Back Squat", "AUTO", "SQUAT"),
        createFixedExerciseDraft("Bench Press", "AUTO", "BENCH"),
        createFixedExerciseDraft("Pull-Up", "AUTO", "PULL"),
      ],
    },
    {
      id: uid("session"),
      key: "D3",
      exercises: [
        createFixedExerciseDraft("Back Squat", "AUTO", "SQUAT"),
        createFixedExerciseDraft("Bench Press", "AUTO", "BENCH"),
        createFixedExerciseDraft("Deadlift", "AUTO", "DEADLIFT"),
      ],
    },
  ];
}

function sessionKeysFromTargets(targets: string[]): string[] {
  if (targets.length <= 2) return ["A", "B"];
  if (targets.length === 3) return ["A", "B", "C"];
  if (targets.length >= 4) return ["1", "2", "3", "4"];
  return ["A", "B"];
}

export function inferSessionDraftsFromTemplate(template: ProgramTemplate): ProgramSessionDraft[] {
  const definition = template.latestVersion?.definition ?? {};
  if (definition?.kind === "manual" && Array.isArray(definition.sessions)) {
    const mapped = definition.sessions.map(sessionDraftFromManual).filter((entry: ProgramSessionDraft) => entry.key);
    if (mapped.length > 0) return mapped;
  }
  if (isOperatorTemplate(template)) {
    return operatorSessionDrafts();
  }

  const targets = normalizeTargets(definition);
  const keys = sessionKeysFromTargets(targets);
  const sessions = keys.map((key) => ({
    id: uid("session"),
    key,
    exercises: [] as ProgramExerciseDraft[],
  }));

  if (targets.length === 0) {
    sessions[0].exercises.push({
      id: uid("exercise"),
      exerciseName: defaultExerciseNameForTarget(template.name),
      mode: "MARKET",
      marketTemplateSlug: template.slug,
      sets: 5,
      reps: 5,
      note: "",
    });
    return sessions;
  }

  targets.forEach((target, index) => {
    const session = sessions[index % sessions.length];
    session.exercises.push({
      id: uid("exercise"),
      exerciseName: defaultExerciseNameForTarget(target),
      mode: "MARKET",
      marketTemplateSlug: template.slug,
      sets: 5,
      reps: 5,
      note: "",
    });
  });

  return sessions;
}

export function makeSessionKeys(rule: SessionRule): string[] {
  if (rule.type === "AB") return ["A", "B"];
  const count = Math.min(4, Math.max(1, Math.floor(rule.count)));
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function reconcileSessionsByKeys(
  current: ProgramSessionDraft[],
  nextKeys: string[],
): ProgramSessionDraft[] {
  const byKey = new Map(current.map((entry) => [entry.key, entry]));
  return nextKeys.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      id: uid("session"),
      key,
      exercises: [],
    };
  });
}

export function createEmptyExerciseDraft(
  defaultSlug: string | null = null,
  rowType: ProgramRowType | null = null,
): ProgramExerciseDraft {
  const operatorDefaults = rowType && isOperatorAutoRowType(rowType) ? resolveOperatorExerciseDefaults("", rowType) : null;
  return {
    id: uid("exercise"),
    exerciseName: "",
    mode: defaultSlug ? "MARKET" : "MANUAL",
    marketTemplateSlug: defaultSlug,
    rowType,
    progressionTarget: null,
    sets: operatorDefaults?.sets ?? 3,
    reps: operatorDefaults?.reps ?? 8,
    note: "",
  };
}

export function moveExerciseBetweenSessions(
  sessions: ProgramSessionDraft[],
  sourceSessionId: string,
  sourceExerciseId: string,
  targetSessionId: string,
  targetIndex: number,
): ProgramSessionDraft[] {
  const sourceSession = sessions.find((session) => session.id === sourceSessionId);
  if (!sourceSession) return sessions;
  const moving = sourceSession.exercises.find((exercise) => exercise.id === sourceExerciseId);
  if (!moving) return sessions;

  const cleaned = sessions.map((session) => {
    if (session.id !== sourceSessionId) return session;
    return {
      ...session,
      exercises: session.exercises.filter((exercise) => exercise.id !== sourceExerciseId),
    };
  });

  return cleaned.map((session) => {
    if (session.id !== targetSessionId) return session;
    const next = [...session.exercises];
    const insertIndex = Math.max(0, Math.min(targetIndex, next.length));
    next.splice(insertIndex, 0, moving);
    return {
      ...session,
      exercises: next,
    };
  });
}

export function reorderExercises(
  sessions: ProgramSessionDraft[],
  sessionId: string,
  sourceExerciseId: string,
  targetExerciseId: string,
): ProgramSessionDraft[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const sourceIndex = session.exercises.findIndex((exercise) => exercise.id === sourceExerciseId);
    const targetIndex = session.exercises.findIndex((exercise) => exercise.id === targetExerciseId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return session;
    const next = [...session.exercises];
    const [moving] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moving);
    return {
      ...session,
      exercises: next,
    };
  });
}

export function toManualDefinition(
  sessions: ProgramSessionDraft[],
  options?: { operatorStyle?: boolean; programFamily?: string | null },
) {
  const normalized: ManualDefinitionSession[] = sessions.map((session) => ({
    key: session.key,
    name: `Session ${session.key}`,
    items: session.exercises.map((exercise) => ({
      exerciseName: exercise.exerciseName.trim() || "Unnamed Exercise",
      role: "MAIN",
      rowType: exercise.rowType ?? undefined,
      progressionTarget: exercise.progressionTarget ?? undefined,
      sets: Array.from({ length: Math.max(1, exercise.sets) }, (_, index) => ({
        setNumber: index + 1,
        reps: Math.max(1, Math.round(exercise.reps)),
        targetWeightKg: 0,
        note:
          exercise.note.trim() ||
          (exercise.mode === "MARKET" && exercise.marketTemplateSlug
            ? `based-on:${exercise.marketTemplateSlug}`
            : undefined),
      })),
    })),
  }));

  return {
    kind: "manual",
    operatorStyle: options?.operatorStyle === true,
    programFamily: options?.programFamily ?? undefined,
    sessions: normalized,
  };
}

export function hasAtLeastOneExercise(sessions: ProgramSessionDraft[]) {
  return sessions.some((session) => session.exercises.length > 0);
}

export function makeForkSlug(prefix: string) {
  const sanitized = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  const timestamp = Date.now().toString(36);
  return `${sanitized || "custom-program"}-${timestamp}`;
}
