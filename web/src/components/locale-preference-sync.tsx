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
  const { setLocale } = useLocale();

  useEffect(() => {
    // 1. Apply local cache immediately
    setLocale(readLocalePreferenceFromLocalCache());

    let cancelled = false;
    
    // 2. Fetch remote source of truth
    (async () => {
      try {
        const snapshot = await fetchSettingsSnapshot();
        if (cancelled) return;
        const nextLocale = normalizeLocalePreference(snapshot[SETTINGS_KEYS.locale]);
        setLocale(nextLocale);
      } catch {
        // Keep local/cookie locale on network failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocale]);

  return null;
}
