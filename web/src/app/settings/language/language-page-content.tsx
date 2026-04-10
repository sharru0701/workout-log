"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { useLocale } from "@/components/locale-provider";
import { createPersistServerSetting } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import {
  SETTINGS_KEYS,
  normalizeLocalePreference,
  type LocalePreference,
} from "@/lib/settings/workout-preferences";
import type { SettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";

const languageOptions: LocalePreference[] = ["ko", "en"];

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

export function LanguagePageContent({ initialSnapshot }: { initialSnapshot: SettingsSnapshot }) {
  const { locale, setLocale, copy } = useLocale();

  const [serverLocale, setServerLocale] = useState<LocalePreference>(() =>
    normalizeLocalePreference(initialSnapshot[SETTINGS_KEYS.locale]),
  );

  const languageSetting = useSettingRowMutation<LocalePreference>({
    key: SETTINGS_KEYS.locale,
    fallbackValue: locale,
    serverValue: serverLocale,
    persistServer: createPersistServerSetting<LocalePreference>(),
    successMessage: copy.settings.languagePage.saveSuccess,
    rollbackNotice: copy.settings.languagePage.rollbackNotice,
  });

  const selectedLocale = useMemo(
    () => normalizeLocalePreference(languageSetting.value),
    [languageSetting.value],
  );

  const selectLanguage = useCallback(async (nextLocale: LocalePreference) => {
    const previousLocale = selectedLocale;
    setLocale(nextLocale);
    const result = await languageSetting.commit(nextLocale);
    if (result.ignored) return;
    if (result.ok) {
      setServerLocale(result.value);
      setLocale(result.value);
      return;
    }
    setLocale(previousLocale);
  }, [languageSetting, selectedLocale, setLocale]);

  return (
    <div>
      <NoticeStateRows
        message={languageSetting.notice}
        tone={languageSetting.error ? "warning" : "success"}
        label={copy.settings.languagePage.noticeLabel}
      />

      <section>
        <SectionHeader
          title={copy.settings.languagePage.title}
          description={copy.settings.languagePage.description}
        />
        <BaseGroupedList ariaLabel={copy.settings.languagePage.title}>
          {languageOptions.map((option) => {
            const optionCopy = copy.settings.languagePage.options[option];
            const active = selectedLocale === option;
            return (
              <NavigationRow
                key={option}
                label={optionCopy.label}
                subtitle={optionCopy.subtitle}
                description={optionCopy.description}
                value={active ? <SelectedCheckIcon /> : null}
                onPress={() => {
                  void selectLanguage(option);
                }}
                disabled={languageSetting.pending}
                showChevron={false}
              />
            );
          })}
        </BaseGroupedList>
        <SectionFootnote>{copy.settings.languagePage.footer}</SectionFootnote>
      </section>
    </div>
  );
}
