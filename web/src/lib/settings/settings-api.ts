import type { PersistSettingFn, SettingValue } from "./update-setting";
import { apiGet, apiPatch } from "@/lib/api";

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

export async function fetchSettingsSnapshot(signal?: AbortSignal): Promise<SettingsSnapshot> {
  const data = await apiGet<FetchSettingsResponse>("/api/settings", { signal });
  return data.settings ?? {};
}

export function createPersistServerSetting<T extends SettingValue>({
  simulateFailure = false,
}: PersistServerSettingOptions = {}): PersistSettingFn<T> {
  return async ({ key, value, signal }) => {
    const data = await apiPatch<SettingsPatchResponse>(
      "/api/settings",
      {
        key,
        value,
        simulateFailure,
      },
      { signal },
    );

    return {
      canonicalValue: (data.setting?.value as T | undefined) ?? value,
    };
  };
}
