import type { PersistSettingFn, SettingValue } from "./update-setting";

type SettingsSnapshot = Record<string, SettingValue>;

type SettingsPatchResponse = {
  ok: boolean;
  setting: {
    key: string;
    value: SettingValue;
  };
  settings: SettingsSnapshot;
};

type FetchSettingsResponse = {
  settings: SettingsSnapshot;
};

type PersistServerSettingOptions = {
  simulateFailure?: boolean;
};

function toApiErrorMessage(raw: unknown, status: number) {
  if (raw && typeof raw === "object" && "error" in raw) {
    const message = (raw as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `설정 저장 요청이 실패했습니다. (${status})`;
}

export async function fetchSettingsSnapshot(signal?: AbortSignal): Promise<SettingsSnapshot> {
  const res = await fetch("/api/settings", {
    method: "GET",
    cache: "no-store",
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as Partial<FetchSettingsResponse> & { error?: unknown };
  if (!res.ok) {
    throw new Error(toApiErrorMessage(data, res.status));
  }
  return data.settings ?? {};
}

export function createPersistServerSetting<T extends SettingValue>({
  simulateFailure = false,
}: PersistServerSettingOptions = {}): PersistSettingFn<T> {
  return async ({ key, value, signal }) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        key,
        value,
        simulateFailure,
      }),
      signal,
    });

    const data = (await res.json().catch(() => ({}))) as Partial<SettingsPatchResponse> & { error?: unknown };
    if (!res.ok) {
      throw new Error(toApiErrorMessage(data, res.status));
    }

    return {
      canonicalValue: (data.setting?.value as T | undefined) ?? value,
    };
  };
}

