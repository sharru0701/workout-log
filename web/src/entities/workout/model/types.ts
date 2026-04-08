import type { AppLocale } from "@/lib/i18n/messages";

export type WorkoutWorkflowState = "idle" | "editing" | "saving" | "done";

export type WorkoutSetModel = {
  count: number;
  reps: number;
  repsPerSet: number[];
  weightKg: number;
};

export type WorkoutPlannedSetMeta = {
  percentPerSet: Array<number | null>;
  targetWeightKgPerSet: Array<number | null>;
  repsPerSet: Array<number | null>;
};

export type WorkoutNoteModel = {
  memo: string;
};

export type WorkoutExerciseSource = "PROGRAM" | "USER";
export type WorkoutExerciseBadge = "AUTO" | "CUSTOM" | "ADDED";

export type WorkoutExerciseModel = {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  source: WorkoutExerciseSource;
  badge?: WorkoutExerciseBadge | null;
  prescribedWeightKg?: number | null;
  plannedSetMeta?: WorkoutPlannedSetMeta | null;
  set: WorkoutSetModel;
  note: WorkoutNoteModel;
};

export type WorkoutSessionModel = {
  logId: string | null;
  generatedSessionId: string | null;
  performedAt: string;
  sessionDate: string;
  timezone: string;
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

export type WorkoutRecordDraft = {
  session: WorkoutSessionModel;
  seedExercises: WorkoutExerciseModel[];
  seedEditLayer: Record<string, SeedExerciseEditPatch>;
  userExercises: WorkoutExerciseModel[];
};

export type SeedExerciseEditPatch = {
  exerciseId?: string | null;
  exerciseName?: string;
  set?: Partial<WorkoutSetModel>;
  note?: Partial<WorkoutNoteModel>;
  deleted?: boolean;
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

export type ExistingWorkoutLogLike = {
  id: string;
  planId: string | null;
  generatedSessionId: string | null;
  performedAt: string;
  notes?: string | null;
  sets: Array<{
    exerciseId?: string | null;
    exerciseName?: string | null;
    sortOrder?: number | null;
    setNumber?: number | null;
    reps?: number | null;
    weightKg?: number | null;
    isExtra?: boolean | null;
    meta?: unknown;
  }>;
  generatedSession?: (GeneratedSessionLike & { updatedAt?: string }) | null;
};

export type WorkoutRecordValidation = {
  valid: boolean;
  errors: string[];
};

export type WorkoutRecordLocale = AppLocale;

export type ExerciseRowAction =
  | { type: "CHANGE_WEIGHT"; value: number }
  | { type: "CHANGE_SET_REPS"; setIndex: number; value: number }
  | { type: "ADD_SET" }
  | { type: "REMOVE_SET"; index: number }
  | { type: "CHANGE_MEMO"; value: string }
  | { type: "DELETE" };

export type WorkoutLogPayload = {
  planId: string;
  generatedSessionId: string | null;
  performedAt: string;
  timezone?: string;
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

export type WorkoutLogBuildOptions = {
  bodyweightKg?: number | null;
  isBodyweightExercise?: (exerciseName: string) => boolean;
};

export type SnapshotSet = {
  reps?: number;
  targetWeightKg?: number;
  weightKg?: number;
  percent?: number;
  note?: string;
};

export type SnapshotExercise = {
  exerciseId?: string | null;
  exerciseName?: string;
  name?: string;
  rowType?: string | null;
  slotRole?: string | null;
  progressionTarget?: string | null;
  progressionKey?: string | null;
  sets?: SnapshotSet[];
};
