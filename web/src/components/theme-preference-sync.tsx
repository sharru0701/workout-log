"use client";

import { useEffect } from "react";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import {
  applyThemePreferenceToDocument,
  readThemePreferenceFromLocalCache,
  readWorkoutPreferences,
} from "@/lib/settings/workout-preferences";

export function ThemePreferenceSync() {
  useEffect(() => {
    applyThemePreferenceToDocument(readThemePreferenceFromLocalCache());

    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchSettingsSnapshot();
        if (cancelled) return;
        const preferences = readWorkoutPreferences(snapshot);
        applyThemePreferenceToDocument(preferences.theme);
      } catch {
        // Ignore fetch failure and keep local/system theme.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
