// 순수 로직(타입·키·normalize·플레이트 규칙)은 @workout/core로 추출됨 — 전부 재export해
// 기존 25개 importer의 경로를 보존한다. 이 파일에는 DOM/localStorage를 만지는
// 브라우저 어댑터만 남는다(core는 DOM 무지 원칙).
export * from "@workout/core/settings/workout-preferences";

import {
  DEFAULT_LOCALE_PREFERENCE,
  DEFAULT_THEME_PREFERENCE,
  LOCAL_STORAGE_SETTING_PREFIX,
  SETTINGS_KEYS,
  normalizeLocalePreference,
  normalizeThemePreference,
  type LocalePreference,
  type ThemePreference,
} from "@workout/core/settings/workout-preferences";

export function applyThemePreferenceToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-preference", theme.toLowerCase());
  // No theme-color injection: Safari uses natural frosted-glass,
  // blurring html { background-color: var(--v2-bg) } behind the pill.
  document.querySelectorAll(`meta[name="theme-color"][data-dynamic]`).forEach(m => m.remove());
}

/** 제거된 레이아웃 테마의 브라우저 캐시를 한 번 정리한다. */
export function clearLegacyThemeSkinPreference() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute("data-theme");
  document.cookie = "wl_skin=; path=/; max-age=0; samesite=lax";
  try {
    window.localStorage.removeItem(
      `${LOCAL_STORAGE_SETTING_PREFIX}prefs.theme.skin`,
    );
  } catch {
    // Storage가 차단된 환경에서도 paper 레이아웃은 그대로 유지한다.
  }
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

export function readLocalePreferenceFromLocalCache(): LocalePreference {
  if (typeof window === "undefined") return DEFAULT_LOCALE_PREFERENCE;
  const raw = window.localStorage.getItem(`${LOCAL_STORAGE_SETTING_PREFIX}${SETTINGS_KEYS.locale}`);
  if (!raw) return DEFAULT_LOCALE_PREFERENCE;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown };
    return normalizeLocalePreference(parsed.value);
  } catch {
    return DEFAULT_LOCALE_PREFERENCE;
  }
}
