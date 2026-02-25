export type SettingValue = string | number | boolean | null;

export type SettingStore = {
  read: (key: string) => SettingValue | undefined;
  write: (key: string, value: SettingValue) => void;
  remove: (key: string) => void;
};

export type PersistSettingInput<T extends SettingValue> = {
  key: string;
  value: T;
  previousValue: T;
  signal?: AbortSignal;
};

export type PersistSettingResult<T extends SettingValue> = {
  canonicalValue?: T;
};

export type PersistSettingFn<T extends SettingValue> = (
  input: PersistSettingInput<T>,
) => Promise<PersistSettingResult<T> | void>;

export type UpdateSettingInput<T extends SettingValue> = {
  key: string;
  nextValue: T;
  getCurrentValue: () => T;
  applyValue: (value: T) => void;
  store: SettingStore;
  persistServer: PersistSettingFn<T>;
  signal?: AbortSignal;
  errorToMessage?: (error: unknown) => string;
};

export type UpdateSettingSuccess<T extends SettingValue> = {
  ok: true;
  key: string;
  previousValue: T;
  value: T;
  rolledBack: false;
};

export type UpdateSettingFailure<T extends SettingValue> = {
  ok: false;
  key: string;
  previousValue: T;
  value: T;
  rolledBack: true;
  error: unknown;
  message: string;
};

export type UpdateSettingResult<T extends SettingValue> =
  | UpdateSettingSuccess<T>
  | UpdateSettingFailure<T>;

type StoreSeed = Record<string, SettingValue>;

const BROWSER_STORE_PREFIX = "workout-log.setting.v1.";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function defaultErrorToMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "저장에 실패했습니다.";
}

function serializeSettingValue(value: SettingValue) {
  return JSON.stringify({ value });
}

function parseSettingValue(raw: string | null): SettingValue | undefined {
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown };
    if (!("value" in parsed)) return undefined;
    const value = parsed.value;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function createMemorySettingStore(seed: StoreSeed = {}): SettingStore {
  const map = new Map<string, SettingValue>(Object.entries(seed));
  return {
    read(key) {
      if (!map.has(key)) return undefined;
      return map.get(key);
    },
    write(key, value) {
      map.set(key, value);
    },
    remove(key) {
      map.delete(key);
    },
  };
}

let browserFallbackMemoryStore: SettingStore | null = null;

export function createBrowserSettingStore(prefix = BROWSER_STORE_PREFIX): SettingStore {
  if (!isBrowser()) {
    browserFallbackMemoryStore ??= createMemorySettingStore();
    return browserFallbackMemoryStore;
  }

  return {
    read(key) {
      return parseSettingValue(window.localStorage.getItem(`${prefix}${key}`));
    },
    write(key, value) {
      window.localStorage.setItem(`${prefix}${key}`, serializeSettingValue(value));
    },
    remove(key) {
      window.localStorage.removeItem(`${prefix}${key}`);
    },
  };
}

export function resolveSettingInitialValue<T extends SettingValue>({
  key,
  store,
  serverValue,
  fallbackValue,
}: {
  key: string;
  store: SettingStore;
  serverValue: T;
  fallbackValue: T;
}) {
  const cached = store.read(key);
  if (cached !== undefined) return cached as T;
  if (serverValue !== undefined) return serverValue;
  return fallbackValue;
}

export async function updateSetting<T extends SettingValue>({
  key,
  nextValue,
  getCurrentValue,
  applyValue,
  store,
  persistServer,
  signal,
  errorToMessage = defaultErrorToMessage,
}: UpdateSettingInput<T>): Promise<UpdateSettingResult<T>> {
  const previousValue = getCurrentValue();

  // Optimistic update: UI and cache are updated before server response.
  applyValue(nextValue);
  store.write(key, nextValue);

  try {
    const remote = await persistServer({
      key,
      value: nextValue,
      previousValue,
      signal,
    });
    const canonicalValue = remote?.canonicalValue ?? nextValue;
    if (canonicalValue !== nextValue) {
      applyValue(canonicalValue);
      store.write(key, canonicalValue);
    }
    return {
      ok: true,
      key,
      previousValue,
      value: canonicalValue,
      rolledBack: false,
    };
  } catch (error) {
    // Rollback policy: restore previous value when server write fails.
    applyValue(previousValue);
    store.write(key, previousValue);
    return {
      ok: false,
      key,
      previousValue,
      value: previousValue,
      rolledBack: true,
      error,
      message: errorToMessage(error),
    };
  }
}

export type SettingUpdateGateRunIgnored = {
  ignored: true;
};

export type SettingUpdateGateRunValue<T> = {
  ignored: false;
  value: T;
};

export type SettingUpdateGate = {
  isPending: (key: string) => boolean;
  run: <T>(key: string, task: () => Promise<T>) => Promise<SettingUpdateGateRunIgnored | SettingUpdateGateRunValue<T>>;
};

export function createSettingUpdateGate(): SettingUpdateGate {
  const inFlight = new Set<string>();
  return {
    isPending(key) {
      return inFlight.has(key);
    },
    async run<T>(key: string, task: () => Promise<T>) {
      if (inFlight.has(key)) {
        return { ignored: true };
      }
      inFlight.add(key);
      try {
        const value = await task();
        return { ignored: false, value };
      } finally {
        inFlight.delete(key);
      }
    },
  };
}

