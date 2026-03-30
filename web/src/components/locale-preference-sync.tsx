"use client";

import { useEffect } from "react";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import {
  SETTINGS_KEYS,
  normalizeLocalePreference,
  readLocalePreferenceFromLocalCache,
} from "@/lib/settings/workout-preferences";
import { useLocale } from "@/components/locale-provider";

export function LocalePreferenceSync() {
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    setLocale(readLocalePreferenceFromLocalCache());
  }, [setLocale]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const snapshot = await fetchSettingsSnapshot();
        const nextLocale = normalizeLocalePreference(snapshot[SETTINGS_KEYS.locale]);
        if (!cancelled && nextLocale !== locale) {
          setLocale(nextLocale);
        }
      } catch {
        // Keep local/cookie locale on network failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, setLocale]);

  return null;
}
