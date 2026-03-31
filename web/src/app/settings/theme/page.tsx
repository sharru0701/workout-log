"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { useLocale } from "@/components/locale-provider";
import { ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import {
  applyThemePreferenceToDocument,
  normalizeThemePreference,
  SETTINGS_KEYS,
  type ThemePreference,
} from "@/lib/settings/workout-preferences";

function SelectedCheckIcon() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        color: "var(--color-accent)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
        borderRadius: "999px",
        background: "var(--color-accent-weak)",
      }}
      aria-hidden="true"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check</span>
    </span>
  );
}

export default function SettingsThemePage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverTheme, setServerTheme] = useState<ThemePreference>("SYSTEM");
  const hasLoadedRef = useRef(false);

  const themeSetting = useSettingRowMutation<string>({
    key: SETTINGS_KEYS.theme,
    fallbackValue: "SYSTEM",
    serverValue: serverTheme,
    persistServer: createPersistServerSetting<string>(),
    successMessage: locale === "ko" ? "테마 설정을 저장했습니다." : "Saved the theme setting.",
    rollbackNotice: locale === "ko" ? "테마 저장 실패로 이전 값으로 되돌렸습니다." : "Failed to save the theme, so the previous value was restored.",
  });

  const loadTheme = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setLoading(true);
      setLoadError(null);
      const snapshot = await fetchSettingsSnapshot();
      hasLoadedRef.current = true;
      setServerTheme(normalizeThemePreference(snapshot[SETTINGS_KEYS.theme]));
    } catch (e: any) {
      setLoadError(e?.message ?? (locale === "ko" ? "테마 설정을 불러오지 못했습니다." : "Could not load theme settings."));
    } finally {
      setLoading(false);
    }
  }, [locale]);

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
  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    subtitle: string;
    description: string;
  }> = useMemo(
    () => [
      {
        value: "LIGHT",
        label: locale === "ko" ? "라이트" : "Light",
        subtitle: "Light",
        description: locale === "ko" ? "항상 밝은 테마로 표시합니다." : "Always use the light theme.",
      },
      {
        value: "DARK",
        label: locale === "ko" ? "다크" : "Dark",
        subtitle: "Dark",
        description: locale === "ko" ? "항상 어두운 테마로 표시합니다." : "Always use the dark theme.",
      },
      {
        value: "SYSTEM",
        label: locale === "ko" ? "시스템 설정 따름" : "Follow System",
        subtitle: "System",
        description: locale === "ko" ? "iOS 시스템 테마 설정을 따릅니다." : "Follow the device theme setting.",
      },
    ],
    [locale],
  );

  return (
    <div>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "40%", marginBottom: 4 }} />
          <div style={{ background: "var(--color-surface-container-low)", borderRadius: 20, overflow: "hidden" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-md)", borderBottom: i < 2 ? "1px solid color-mix(in srgb, var(--color-outline-variant) 14%, transparent)" : "none" }}>
                <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 14, width: "35%" }} />
                <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: "50%", height: 20, width: 20 }} />
              </div>
            ))}
          </div>
        </div>
      )}
      <ErrorStateRows
        message={loadError}
        title={locale === "ko" ? "테마 설정 조회 실패" : "Could not load theme settings"}
        onRetry={() => {
          void loadTheme();
        }}
      />
      <NoticeStateRows message={themeSetting.notice} tone={themeSetting.error ? "warning" : "success"} label={locale === "ko" ? "테마 안내" : "Theme Notice"} />

      <section>
        <SectionHeader title={locale === "ko" ? "테마 설정" : "Theme"} description={locale === "ko" ? "라이트 / 다크 / 시스템 설정 따름" : "Light / Dark / Follow System"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "테마 선택" : "Theme selection"}>
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
        <SectionFootnote>{locale === "ko" ? "저장 즉시 앱 전체 테마가 변경됩니다." : "The app theme changes immediately after saving."}</SectionFootnote>
      </section>
    </div>
  );
}
