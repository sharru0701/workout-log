export type SettingValue = string | number | boolean | null;
export type SettingsSnapshot = Record<string, SettingValue>;

export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export type MinimumPlateRule = {
  exerciseId: string | null;
  exerciseName: string;
  incrementKg: number;
};

export type WorkoutPreferences = {
  theme: ThemePreference;
  minimumPlateDefaultKg: number;
  minimumPlateRules: MinimumPlateRule[];
  bodyweightKg: number | null;
};

export const SETTINGS_KEYS = {
  theme: "prefs.theme.mode",
  minimumPlateDefaultKg: "prefs.minimumPlate.defaultKg",
  minimumPlateRulesJson: "prefs.minimumPlate.rulesJson",
  bodyweightKg: "prefs.bodyweight.kg",
} as const;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "SYSTEM";
export const DEFAULT_MINIMUM_PLATE_KG = 2.5;
export const DEFAULT_BODYWEIGHT_KG: number | null = null;

const MIN_INCREMENT_KG = 0.25;
const MAX_INCREMENT_KG = 25;
const LOCAL_STORAGE_SETTING_PREFIX = "workout-log.setting.v1.";

function toRounded2(value: number) {
  return Math.round(value * 100) / 100;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "LIGHT") return "LIGHT";
  if (normalized === "DARK") return "DARK";
  return "SYSTEM";
}

export function normalizeIncrementKg(value: unknown, fallback = DEFAULT_MINIMUM_PLATE_KG): number {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return fallback;
  return toRounded2(Math.max(MIN_INCREMENT_KG, Math.min(MAX_INCREMENT_KG, parsed)));
}

function normalizeRule(raw: unknown): MinimumPlateRule | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const incrementKg = normalizeIncrementKg(record.incrementKg, Number.NaN);
  if (!Number.isFinite(incrementKg)) return null;

  const exerciseIdRaw = typeof record.exerciseId === "string" ? record.exerciseId.trim() : "";
  const exerciseName = typeof record.exerciseName === "string" ? record.exerciseName.trim() : "";
  if (!exerciseName) return null;

  return {
    exerciseId: exerciseIdRaw || null,
    exerciseName,
    incrementKg,
  };
}

export function parseMinimumPlateRules(value: unknown): MinimumPlateRule[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const normalized: MinimumPlateRule[] = [];
    const dedupe = new Set<string>();
    for (const entry of parsed) {
      const rule = normalizeRule(entry);
      if (!rule) continue;
      const key = rule.exerciseId ? `id:${rule.exerciseId}` : `name:${rule.exerciseName.toLowerCase()}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      normalized.push(rule);
    }
    return normalized;
  } catch {
    return [];
  }
}

export function serializeMinimumPlateRules(rules: MinimumPlateRule[]): string {
  const normalized = rules
    .map((rule) => normalizeRule(rule))
    .filter(Boolean) as MinimumPlateRule[];
  return JSON.stringify(normalized);
}

export function readWorkoutPreferences(snapshot: SettingsSnapshot): WorkoutPreferences {
  const theme = normalizeThemePreference(snapshot[SETTINGS_KEYS.theme]);
  const minimumPlateDefaultKg = normalizeIncrementKg(
    snapshot[SETTINGS_KEYS.minimumPlateDefaultKg],
    DEFAULT_MINIMUM_PLATE_KG,
  );
  const minimumPlateRules = parseMinimumPlateRules(snapshot[SETTINGS_KEYS.minimumPlateRulesJson]);
  const bodyweightRaw = toFiniteNumber(snapshot[SETTINGS_KEYS.bodyweightKg]);
  const bodyweightKg =
    bodyweightRaw === null || bodyweightRaw <= 0 ? DEFAULT_BODYWEIGHT_KG : toRounded2(bodyweightRaw);

  return {
    theme,
    minimumPlateDefaultKg,
    minimumPlateRules,
    bodyweightKg,
  };
}

export function toDefaultWorkoutPreferences(): WorkoutPreferences {
  return {
    theme: DEFAULT_THEME_PREFERENCE,
    minimumPlateDefaultKg: DEFAULT_MINIMUM_PLATE_KG,
    minimumPlateRules: [],
    bodyweightKg: DEFAULT_BODYWEIGHT_KG,
  };
}

export function resolveMinimumPlateIncrementKg(
  preferences: Pick<WorkoutPreferences, "minimumPlateDefaultKg" | "minimumPlateRules">,
  input: {
    exerciseId?: string | null;
    exerciseName: string;
  },
): number {
  const byId = input.exerciseId
    ? preferences.minimumPlateRules.find((rule) => rule.exerciseId === input.exerciseId)
    : null;
  if (byId) return byId.incrementKg;

  const nameKey = input.exerciseName.trim().toLowerCase();
  if (nameKey) {
    const byName = preferences.minimumPlateRules.find(
      (rule) => !rule.exerciseId && rule.exerciseName.trim().toLowerCase() === nameKey,
    );
    if (byName) return byName.incrementKg;
  }

  return preferences.minimumPlateDefaultKg;
}

export function snapWeightToIncrementKg(weightKg: number, incrementKg: number): number {
  const safeWeight = Number.isFinite(weightKg) ? Math.max(0, weightKg) : 0;
  const safeIncrement = normalizeIncrementKg(incrementKg, DEFAULT_MINIMUM_PLATE_KG);
  if (safeIncrement <= 0) return toRounded2(safeWeight);
  return toRounded2(Math.round(safeWeight / safeIncrement) * safeIncrement);
}

export function isBodyweightRelatedExerciseName(exerciseName: string): boolean {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("pull-up") ||
    normalized.includes("pull up") ||
    normalized.includes("chin-up") ||
    normalized.includes("chin up") ||
    normalized.includes("풀업") ||
    normalized.includes("친업")
  );
}

export function computeBodyweightTotalLoadKg(
  exerciseName: string,
  externalWeightKg: number,
  bodyweightKg: number | null,
): number | null {
  if (!isBodyweightRelatedExerciseName(exerciseName)) return null;
  if (bodyweightKg === null || bodyweightKg <= 0) return null;
  const external = Number.isFinite(externalWeightKg) ? Math.max(0, externalWeightKg) : 0;
  return toRounded2(bodyweightKg + external);
}

export function applyThemePreferenceToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-preference", theme.toLowerCase());
}

export function readThemePreferenceFromLocalCache(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFERENCE;
  const raw = window.localStorage.getItem(`${LOCAL_STORAGE_SETTING_PREFIX}${SETTINGS_KEYS.theme}`);
  if (!raw) return DEFAULT_THEME_PREFERENCE;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown };
    return normalizeThemePreference(parsed.value);
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}
