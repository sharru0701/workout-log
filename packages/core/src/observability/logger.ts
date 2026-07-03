export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function toSerializable(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      toSerializable(v),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}

function writeLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const serializableFields = toSerializable(fields);
  const payloadFields =
    serializableFields && typeof serializableFields === "object"
      ? (serializableFields as Record<string, unknown>)
      : {};

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payloadFields,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, fields?: LogFields) {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields) {
  writeLog("warn", event, fields);
}

export function logError(event: string, fields?: LogFields) {
  writeLog("error", event, fields);
}
