// 순수 로직(타입·키·normalize·플레이트 규칙)은 @workout/core로 추출됨 — 전부 재export해
// 기존 25개 importer의 경로를 보존한다. 이 파일에는 DOM/localStorage를 만지는
// 브라우저 어댑터만 남는다(core는 DOM 무지 원칙).
export * from "@workout/core/settings/workout-preferences";

import {
  DEFAULT_LOCALE_PREFERENCE,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_THEME_SKIN,
  LOCAL_STORAGE_SETTING_PREFIX,
  SETTINGS_KEYS,
  THEME_SKIN_COOKIE_NAME,
  normalizeLocalePreference,
  normalizeThemePreference,
  normalizeThemeSkin,
  type LocalePreference,
  type ThemePreference,
  type ThemeSkin,
} from "@workout/core/settings/workout-preferences";
import { setThemeSkin } from "./theme-skin-store";

export function applyThemePreferenceToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-preference", theme.toLowerCase());
  // No theme-color injection: Safari uses natural frosted-glass,
  // blurring html { background-color: var(--v2-bg) } behind the pill.
  document.querySelectorAll(`meta[name="theme-color"][data-dynamic]`).forEach(m => m.remove());
}

export function applyThemeSkinToDocument(skin: ThemeSkin) {
  if (typeof document === "undefined") return;
  if (skin === "terminal") {
    document.documentElement.setAttribute("data-theme", "terminal");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  // SSR 첫 렌더 셸 선택용 쿠키에 미러링(서버 resolveRequestSkin이 읽음). 단일 write 경로이므로
  // boot·설정토글·서버sync가 모두 여기서 쿠키를 최신화 → 다음 로드부터 per-load remount 0.
  document.cookie = `${THEME_SKIN_COOKIE_NAME}=${skin}; path=/; max-age=31536000; samesite=lax`;
  setThemeSkin(skin);
}

export function readThemeSkinFromLocalCache(): ThemeSkin {
  if (typeof window === "undefined") return DEFAULT_THEME_SKIN;
  const raw = window.localStorage.getItem(`${LOCAL_STORAGE_SETTING_PREFIX}${SETTINGS_KEYS.themeSkin}`);
  if (!raw) return DEFAULT_THEME_SKIN;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown };
    return normalizeThemeSkin(parsed.value);
  } catch {
    return DEFAULT_THEME_SKIN;
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
