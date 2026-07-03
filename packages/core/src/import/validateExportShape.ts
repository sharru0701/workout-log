const SUPPORTED_VERSIONS = new Set<number>([1]);

export function validateExportShape(input: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["import body must be a JSON object"] };
  }
  const obj = input as Record<string, unknown>;
  const version = Number(obj.version);
  if (!Number.isFinite(version)) {
    errors.push("version must be a number");
  } else if (!SUPPORTED_VERSIONS.has(version)) {
    errors.push(`unsupported export version: ${version}`);
  }
  if (typeof obj.userId !== "string") {
    errors.push("userId must be a string");
  }
  if (typeof obj.exportedAt !== "string") {
    errors.push("exportedAt must be a string");
  }
  for (const key of [
    "templates",
    "templateVersions",
    "plans",
    "planModules",
    "planOverrides",
    "generatedSessions",
    "workoutLogs",
    "workoutSets",
  ]) {
    if (!Array.isArray(obj[key])) {
      errors.push(`${key} must be an array`);
    }
  }
  return { ok: errors.length === 0, errors };
}
