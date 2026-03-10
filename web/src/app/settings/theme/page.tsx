"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import {
  applyThemePreferenceToDocument,
  normalizeThemePreference,
  SETTINGS_KEYS,
  type ThemePreference,
} from "@/lib/settings/workout-preferences";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  subtitle: string;
  description: string;
}> = [
  {
    value: "LIGHT",
    label: "라이트",
    subtitle: "Light",
    description: "항상 밝은 테마로 표시합니다.",
  },
  {
    value: "DARK",
    label: "다크",
    subtitle: "Dark",
    description: "항상 어두운 테마로 표시합니다.",
  },
  {
    value: "SYSTEM",
    label: "시스템 설정 따름",
    subtitle: "System",
    description: "iOS 시스템 테마 설정을 따릅니다.",
  },
];

function SelectedCheckIcon() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
      style={{
        color: "var(--accent-primary)",
        borderColor: "var(--accent-primary)",
        background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.2 8.4 6.6 11.6 12.8 4.8" />
      </svg>
    </span>
  );
}

export default function SettingsThemePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverTheme, setServerTheme] = useState<ThemePreference>("SYSTEM");

  const themeSetting = useSettingRowMutation<string>({
    key: SETTINGS_KEYS.theme,
    fallbackValue: "SYSTEM",
    serverValue: serverTheme,
    persistServer: createPersistServerSetting<string>(),
    successMessage: "테마 설정을 저장했습니다.",
    rollbackNotice: "테마 저장 실패로 이전 값으로 되돌렸습니다.",
  });

  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const snapshot = await fetchSettingsSnapshot();
      setServerTheme(normalizeThemePreference(snapshot[SETTINGS_KEYS.theme]));
    } catch (e: any) {
      setLoadError(e?.message ?? "테마 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    applyThemePreferenceToDocument(normalizeThemePreference(themeSetting.value));
  }, [themeSetting.value]);

  const selectedTheme = useMemo(
    () => normalizeThemePreference(themeSetting.value),
    [themeSetting.value],
  );

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={120}
        label="테마 설정 로딩 중"
        description="현재 테마 설정을 확인하고 있습니다."
      />
      <ErrorStateRows
        message={loadError}
        title="테마 설정 조회 실패"
        onRetry={() => {
          void loadTheme();
        }}
      />
      <NoticeStateRows message={themeSetting.notice} tone={themeSetting.error ? "warning" : "success"} label="테마 안내" />

      <section className="grid gap-2">
        <SectionHeader title="테마 설정" description="라이트 / 다크 / 시스템 설정 따름" />
        <BaseGroupedList ariaLabel="Theme selection">
          {themeOptions.map((option) => {
            const active = selectedTheme === option.value;
            return (
              <NavigationRow
                key={option.value}
                label={option.label}
                subtitle={option.subtitle}
                description={option.description}
                value={active ? <SelectedCheckIcon /> : null}
                onPress={() => {
                  void themeSetting.commit(option.value);
                }}
                disabled={themeSetting.pending}
                showChevron={false}
              />
            );
          })}
        </BaseGroupedList>
        <SectionFootnote>저장 즉시 앱 전체 테마가 변경됩니다.</SectionFootnote>
      </section>
    </div>
  );
}
