export type WorkoutWorkflowState = "idle" | "editing" | "saving" | "done";

export type WorkoutSetModel = {
  count: number;
  reps: number;
  repsPerSet: number[];
  weightKg: number;
};

export type WorkoutNoteModel = {
  memo: string;
};

export type WorkoutExerciseSource = "PROGRAM" | "USER";

export type WorkoutExerciseModel = {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  source: WorkoutExerciseSource;
  set: WorkoutSetModel;
  note: WorkoutNoteModel;
};

export type WorkoutSessionModel = {
  generatedSessionId: string | null;
  planId: string;
  planName: string;
  sessionKey: string;
  week: number;
  day: number;
  sessionType: string;
  estimatedE1rmKg: number | null;
  estimatedTmKg: number | null;
  note: WorkoutNoteModel;
};

export type SeedExerciseEditPatch = {
  exerciseId?: string | null;
  exerciseName?: string;
  set?: Partial<WorkoutSetModel>;
  note?: Partial<WorkoutNoteModel>;
  deleted?: boolean;
};

export type WorkoutRecordDraft = {
  session: WorkoutSessionModel;
  seedExercises: WorkoutExerciseModel[];
  seedEditLayer: Record<string, SeedExerciseEditPatch>;
  userExercises: WorkoutExerciseModel[];
};

export type WorkoutExerciseViewModel = WorkoutExerciseModel & {
  isEdited: boolean;
  deleted: boolean;
};

export type GeneratedSessionLike = {
  id: string;
  planId: string;
  sessionKey: string;
  snapshot: any;
};

export type WorkoutRecordValidation = {
  valid: boolean;
  errors: string[];
};

export type WorkoutLogPayload = {
  planId: string;
  generatedSessionId: string | null;
  performedAt: string;
  durationMinutes: number | null;
  notes: string | null;
  sets: Array<{
    exerciseId?: string | null;
    exerciseName: string;
    setNumber: number;
    reps: number;
    weightKg: number;
    rpe: number;
    isExtra: boolean;
    meta: Record<string, unknown>;
  }>;
};

type WorkoutLogBuildOptions = {
  bodyweightKg?: number | null;
  isBodyweightExercise?: (exerciseName: string) => boolean;
};

type SnapshotSet = {
  reps?: number;
  targetWeightKg?: number;
  weightKg?: number;
  percent?: number;
  note?: string;
};

type SnapshotExercise = {
  exerciseId?: string | null;
  exerciseName?: string;
  name?: string;
  sets?: SnapshotSet[];
};

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizeRepsValue(value: unknown, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(1, Math.round(parsed)));
}

function normalizeRepsPerSetArray(
  value: unknown,
  fallbackReps = 5,
  fallbackCount = 1,
): number[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeRepsValue(entry, fallbackReps))
      .filter((entry) => Number.isFinite(entry))
      .slice(0, 50);
    if (normalized.length > 0) return normalized;
  }

  const count = Math.min(50, Math.max(1, Math.round(toNumber(fallbackCount, 1))));
  const reps = normalizeRepsValue(fallbackReps, 5);
  return Array.from({ length: count }, () => reps);
}

function nonEmpty(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function estimateE1rm(weightKg: number, reps: number) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  const effectiveReps = Math.min(reps, 15);
  return weightKg * (1 + effectiveReps / 30);
}

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

function deriveEstimateFromSnapshot(exercises: SnapshotExercise[]) {
  let estimatedE1rmKg: number | null = null;
  let estimatedTmKg: number | null = null;

  for (const exercise of exercises) {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    for (const set of sets) {
      const reps = toNumber(set.reps, 0);
      const weightKg = toNumber(set.targetWeightKg ?? set.weightKg, 0);
      const e1rm = estimateE1rm(weightKg, reps);
      if (e1rm !== null) {
        estimatedE1rmKg = estimatedE1rmKg === null ? e1rm : Math.max(estimatedE1rmKg, e1rm);
      }

      const percent = Number(set.percent);
      if (Number.isFinite(percent) && percent > 0 && weightKg > 0) {
        const tm = weightKg / percent;
        estimatedTmKg = estimatedTmKg === null ? tm : Math.max(estimatedTmKg, tm);
      }
    }
  }

  return {
    estimatedE1rmKg: estimatedE1rmKg === null ? null : Math.round(estimatedE1rmKg),
    estimatedTmKg: estimatedTmKg === null ? null : Math.round(estimatedTmKg),
  };
}

function toSessionType(day: number) {
  return day % 2 === 1 ? "A Session" : "B Session";
}

function toSeedExercise(exercise: SnapshotExercise, index: number): WorkoutExerciseModel {
  const sets = Array.isArray(exercise.sets) && exercise.sets.length > 0 ? exercise.sets : [{}];
  const first = sets[0] ?? {};
  const repsPerSet = normalizeRepsPerSetArray(
    sets.map((set) => set?.reps),
    toNumber(first.reps, 5),
    sets.length,
  );

  return {
    id: `seed-${index + 1}`,
    exerciseId: typeof exercise.exerciseId === "string" ? exercise.exerciseId : null,
    exerciseName: nonEmpty(String(exercise.exerciseName ?? exercise.name ?? ""), `Exercise ${index + 1}`),
    source: "PROGRAM",
    set: {
      count: repsPerSet.length,
      reps: repsPerSet[0] ?? 5,
      repsPerSet,
      weightKg: Math.max(0, toNumber(first.targetWeightKg ?? first.weightKg, 0)),
    },
    note: {
      memo: typeof first.note === "string" ? first.note : "",
    },
  };
}

function mergeSetModel(base: WorkoutSetModel, patch?: Partial<WorkoutSetModel>): WorkoutSetModel {
  const baseRepsPerSet = normalizeRepsPerSetArray(base.repsPerSet, base.reps, base.count);
  let nextRepsPerSet = baseRepsPerSet;

  if (patch?.repsPerSet !== undefined) {
    nextRepsPerSet = normalizeRepsPerSetArray(patch.repsPerSet, base.reps, base.count);
  } else {
    const requestedCount = patch?.count !== undefined ? Math.max(1, Math.min(50, Math.round(patch.count))) : baseRepsPerSet.length;
    const requestedReps = patch?.reps !== undefined ? normalizeRepsValue(patch.reps, base.reps) : null;

    if (requestedCount !== baseRepsPerSet.length || requestedReps !== null) {
      const fallbackReps = requestedReps ?? baseRepsPerSet[baseRepsPerSet.length - 1] ?? base.reps;
      nextRepsPerSet = Array.from({ length: requestedCount }, (_, index) =>
        requestedReps ?? baseRepsPerSet[index] ?? fallbackReps,
      );
    }
  }

  return {
    count: nextRepsPerSet.length,
    reps: nextRepsPerSet[0] ?? 5,
    repsPerSet: nextRepsPerSet,
    weightKg: patch?.weightKg !== undefined ? Math.max(0, Number(patch.weightKg)) : base.weightKg,
  };
}

function mergeSeedExercise(base: WorkoutExerciseModel, patch: SeedExerciseEditPatch | undefined): WorkoutExerciseViewModel {
  if (!patch) {
    return {
      ...base,
      isEdited: false,
      deleted: false,
    };
  }

  const next: WorkoutExerciseViewModel = {
    ...base,
    exerciseId: patch.exerciseId !== undefined ? patch.exerciseId : base.exerciseId,
    exerciseName: patch.exerciseName ?? base.exerciseName,
    set: mergeSetModel(base.set, patch.set),
    note: {
      memo: patch.note?.memo ?? base.note.memo,
    },
    isEdited: true,
    deleted: Boolean(patch.deleted),
  };

  return next;
}

export function createWorkoutRecordDraft(session: GeneratedSessionLike, planName: string): WorkoutRecordDraft {
  const snapshot = session.snapshot ?? {};
  const week = Math.max(1, Math.round(toNumber(snapshot.week, 1)));
  const day = Math.max(1, Math.round(toNumber(snapshot.day, 1)));
  const exercises = (Array.isArray(snapshot.exercises) ? snapshot.exercises : []) as SnapshotExercise[];
  const estimate = deriveEstimateFromSnapshot(exercises);

  return {
    session: {
      generatedSessionId: session.id ?? null,
      planId: session.planId,
      planName: nonEmpty(planName, "프로그램 미선택"),
      sessionKey: nonEmpty(String(snapshot.sessionKey ?? session.sessionKey ?? ""), "W1D1"),
      week,
      day,
      sessionType: toSessionType(day),
      estimatedE1rmKg: estimate.estimatedE1rmKg,
      estimatedTmKg: estimate.estimatedTmKg,
      note: { memo: "" },
    },
    seedExercises: exercises.map(toSeedExercise),
    seedEditLayer: {},
    userExercises: [],
  };
}

export function materializeWorkoutExercises(draft: WorkoutRecordDraft): WorkoutExerciseViewModel[] {
  const seeded = draft.seedExercises
    .map((exercise) => mergeSeedExercise(exercise, draft.seedEditLayer[exercise.id]))
    .filter((exercise) => !exercise.deleted);

  const users = draft.userExercises.map((exercise) => ({
    ...exercise,
    isEdited: true,
    deleted: false,
  }));

  return [...seeded, ...users];
}

export function hasWorkoutEdits(draft: WorkoutRecordDraft) {
  if (draft.userExercises.length > 0) return true;
  return Object.values(draft.seedEditLayer).some((patch) => {
    if (!patch) return false;
    return Boolean(
      patch.deleted ||
        patch.exerciseId !== undefined ||
        patch.exerciseName !== undefined ||
        patch.set?.count !== undefined ||
        patch.set?.reps !== undefined ||
        patch.set?.repsPerSet !== undefined ||
        patch.set?.weightKg !== undefined ||
        patch.note?.memo !== undefined,
    );
  });
}

export function patchSeedExercise(
  draft: WorkoutRecordDraft,
  seedId: string,
  patch: SeedExerciseEditPatch,
): WorkoutRecordDraft {
  return {
    ...draft,
    seedEditLayer: {
      ...draft.seedEditLayer,
      [seedId]: {
        ...draft.seedEditLayer[seedId],
        ...patch,
        set: {
          ...draft.seedEditLayer[seedId]?.set,
          ...patch.set,
        },
        note: {
          ...draft.seedEditLayer[seedId]?.note,
          ...patch.note,
        },
      },
    },
  };
}

export function removeSeedExercise(draft: WorkoutRecordDraft, seedId: string): WorkoutRecordDraft {
  return patchSeedExercise(draft, seedId, { deleted: true });
}

export function addUserExercise(
  draft: WorkoutRecordDraft,
  input: {
    exerciseId?: string | null;
    exerciseName: string;
    weightKg: number;
    sets?: number;
    reps?: number;
    repsPerSet?: number[];
    memo: string;
  },
): WorkoutRecordDraft {
  const userIndex = draft.userExercises.length + 1;
  const repsPerSet = normalizeRepsPerSetArray(input.repsPerSet, input.reps ?? 5, input.sets ?? 1);
  const userExercise: WorkoutExerciseModel = {
    id: `user-${Date.now()}-${userIndex}`,
    exerciseId: input.exerciseId ?? null,
    exerciseName: nonEmpty(input.exerciseName, `Custom Exercise ${userIndex}`),
    source: "USER",
    set: {
      count: repsPerSet.length,
      reps: repsPerSet[0] ?? 5,
      repsPerSet,
      weightKg: Math.max(0, input.weightKg),
    },
    note: {
      memo: input.memo.trim(),
    },
  };

  return {
    ...draft,
    userExercises: [...draft.userExercises, userExercise],
  };
}

export function updateUserExercise(
  draft: WorkoutRecordDraft,
  userId: string,
  patch: SeedExerciseEditPatch,
): WorkoutRecordDraft {
  return {
    ...draft,
    userExercises: draft.userExercises.map((exercise) => {
      if (exercise.id !== userId) return exercise;
      return {
        ...exercise,
        exerciseId: patch.exerciseId !== undefined ? patch.exerciseId : exercise.exerciseId,
        exerciseName: patch.exerciseName ?? exercise.exerciseName,
        set: mergeSetModel(exercise.set, patch.set),
        note: {
          memo: patch.note?.memo ?? exercise.note.memo,
        },
      };
    }),
  };
}

export function removeUserExercise(draft: WorkoutRecordDraft, userId: string): WorkoutRecordDraft {
  return {
    ...draft,
    userExercises: draft.userExercises.filter((exercise) => exercise.id !== userId),
  };
}

export function validateWorkoutDraft(draft: WorkoutRecordDraft): WorkoutRecordValidation {
  const exercises = materializeWorkoutExercises(draft);
  const errors: string[] = [];

  if (exercises.length === 0) {
    errors.push("최소 1개 이상의 운동이 필요합니다.");
  }

  exercises.forEach((exercise, index) => {
    const row = index + 1;
    if (!exercise.exerciseName.trim()) {
      errors.push(`${row}번째 운동의 종목명이 비어 있습니다.`);
    }
    if (!Number.isFinite(exercise.set.count) || exercise.set.count < 1 || exercise.set.count > 50) {
      errors.push(`${row}번째 운동의 세트 수는 1~50 범위여야 합니다.`);
    }
    const repsPerSet = normalizeRepsPerSetArray(exercise.set.repsPerSet, exercise.set.reps, exercise.set.count);
    if (repsPerSet.length !== exercise.set.count) {
      errors.push(`${row}번째 운동의 세트별 횟수 정보가 올바르지 않습니다.`);
    }
    repsPerSet.forEach((reps, setIndex) => {
      if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
        errors.push(`${row}번째 운동의 ${setIndex + 1}세트 횟수는 1~100 범위여야 합니다.`);
      }
    });
    if (!Number.isFinite(exercise.set.weightKg) || exercise.set.weightKg < 0 || exercise.set.weightKg > 1000) {
      errors.push(`${row}번째 운동의 무게는 0~1000kg 범위여야 합니다.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function toWorkoutLogPayload(
  draft: WorkoutRecordDraft,
  options: WorkoutLogBuildOptions = {},
): WorkoutLogPayload {
  const exercises = materializeWorkoutExercises(draft);
  const sets: WorkoutLogPayload["sets"] = [];
  const bodyweightKg =
    Number.isFinite(options.bodyweightKg) && Number(options.bodyweightKg) > 0
      ? roundTo2(Number(options.bodyweightKg))
      : null;
  const isBodyweightExercise = options.isBodyweightExercise;

  exercises.forEach((exercise) => {
    const repsPerSet = normalizeRepsPerSetArray(exercise.set.repsPerSet, exercise.set.reps, exercise.set.count);
    const weightKg = roundTo2(Math.max(0, Number(exercise.set.weightKg ?? 0)));
    const exerciseName = exercise.exerciseName.trim();
    const attachBodyweightMeta =
      Boolean(bodyweightKg) &&
      typeof isBodyweightExercise === "function" &&
      isBodyweightExercise(exerciseName);
    repsPerSet.forEach((repsValue, index) => {
      const meta: Record<string, unknown> = exercise.note.memo.trim()
        ? { memo: exercise.note.memo.trim() }
        : {};
      if (attachBodyweightMeta && bodyweightKg !== null) {
        meta.bodyweightKg = bodyweightKg;
        meta.totalLoadKg = roundTo2(bodyweightKg + weightKg);
      }

      sets.push({
        exerciseId: exercise.exerciseId,
        exerciseName,
        setNumber: index + 1,
        reps: Math.max(1, Math.round(repsValue)),
        weightKg,
        rpe: 0,
        isExtra: exercise.source === "USER",
        meta,
      });
    });
  });

  const note = draft.session.note.memo.trim();
  return {
    planId: draft.session.planId,
    generatedSessionId: draft.session.generatedSessionId,
    performedAt: new Date().toISOString(),
    durationMinutes: null,
    notes: note.length > 0 ? note : null,
    sets,
  };
}
