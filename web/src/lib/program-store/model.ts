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

export type ProgramExerciseMode = "MARKET" | "MANUAL";

export type ProgramExerciseDraft = {
  id: string;
  exerciseName: string;
  mode: ProgramExerciseMode;
  marketTemplateSlug: string | null;
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
    sets: Array<{
      setNumber: number;
      reps: number;
      targetWeightKg: number;
      note?: string;
    }>;
  }>;
};

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
        sets: Math.max(1, sets.length || Number(item?.setsCount) || 1),
        reps: Math.max(1, Number(first?.reps) || Number(item?.reps) || 5),
        note: typeof first?.note === "string" ? first.note : "",
      };
    }),
  };
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

export function createEmptyExerciseDraft(defaultSlug: string | null = null): ProgramExerciseDraft {
  return {
    id: uid("exercise"),
    exerciseName: "",
    mode: defaultSlug ? "MARKET" : "MANUAL",
    marketTemplateSlug: defaultSlug,
    sets: 3,
    reps: 8,
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

export function toManualDefinition(sessions: ProgramSessionDraft[]) {
  const normalized: ManualDefinitionSession[] = sessions.map((session) => ({
    key: session.key,
    name: `Session ${session.key}`,
    items: session.exercises.map((exercise) => ({
      exerciseName: exercise.exerciseName.trim() || "Unnamed Exercise",
      role: "MAIN",
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
