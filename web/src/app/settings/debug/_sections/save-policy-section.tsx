"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { NoticeStateRows } from "@/components/ui/settings-state";
import {
  V2Chip,
  V2NavRow,
  V2Switch,
} from "@/components/v2/primitives";
import {
  V2SettingsFootnote,
  V2SettingsGroup,
  V2SettingsSection,
  mergeRowSubtitle,
} from "@/components/v2/settings/section";
import { createPersistServerSetting } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";

const TIMEZONE_OPTIONS = ["UTC", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "Europe/London"] as const;

function nextTimezone(current: string) {
  const currentIndex = TIMEZONE_OPTIONS.indexOf(current as (typeof TIMEZONE_OPTIONS)[number]);
  if (currentIndex < 0) return TIMEZONE_OPTIONS[0];
  return TIMEZONE_OPTIONS[(currentIndex + 1) % TIMEZONE_OPTIONS.length];
}

export function SavePolicySection() {
  const { copy } = useLocale();
  const [simulateFailureOnNextSave, setSimulateFailureOnNextSave] = useState(false);

  const consumeFailureFlag = useCallback(() => {
    if (!simulateFailureOnNextSave) return false;
    setSimulateFailureOnNextSave(false);
    return true;
  }, [simulateFailureOnNextSave]);

  const persistAutoSync = useCallback(
    async (...args: Parameters<ReturnType<typeof createPersistServerSetting<boolean>>>) =>
      createPersistServerSetting<boolean>({ simulateFailure: consumeFailureFlag() })(...args),
    [consumeFailureFlag],
  );

  const persistTimezone = useCallback(
    async (...args: Parameters<ReturnType<typeof createPersistServerSetting<string>>>) =>
      createPersistServerSetting<string>({ simulateFailure: consumeFailureFlag() })(...args),
    [consumeFailureFlag],
  );

  const autoSync = useSettingRowMutation<boolean>({
    key: "prefs.autoSync",
    fallbackValue: true,
    persistServer: persistAutoSync,
    successMessage: copy.settings.savePolicyPage.saveSuccessAutoSync,
    rollbackNotice: copy.settings.savePolicyPage.rollbackAutoSync,
  });

  const timezone = useSettingRowMutation<string>({
    key: "prefs.timezone",
    fallbackValue: "UTC",
    persistServer: persistTimezone,
    successMessage: copy.settings.savePolicyPage.saveSuccessTimezone,
    rollbackNotice: copy.settings.savePolicyPage.rollbackTimezone,
  });

  const latestNotice = useMemo(() => {
    if (autoSync.notice) return autoSync.notice;
    if (timezone.notice) return timezone.notice;
    return null;
  }, [autoSync.notice, timezone.notice]);

  return (
    <div>
      <section>
        <V2SettingsSection title={copy.settings.savePolicyPage.failureSimulation.title} />
        <V2SettingsGroup ariaLabel={copy.settings.savePolicyPage.failureSimulation.ariaLabel}>
          <V2NavRow
            as="div"
            label={copy.settings.savePolicyPage.failureSimulation.nextSaveFailure}
            description={copy.settings.savePolicyPage.failureSimulation.description}
            badge={
              simulateFailureOnNextSave ? (
                <V2Chip tone="warning">!</V2Chip>
              ) : undefined
            }
            trailing={
              <V2Switch
                checked={simulateFailureOnNextSave}
                onCheckedChange={setSimulateFailureOnNextSave}
                aria-label={copy.settings.savePolicyPage.failureSimulation.nextSaveFailure}
              />
            }
          />
        </V2SettingsGroup>
        <V2SettingsFootnote>{copy.settings.savePolicyPage.failureSimulation.footnote}</V2SettingsFootnote>
      </section>

      <section>
        <V2SettingsSection title={copy.settings.savePolicyPage.optimistic.title} />
        <V2SettingsGroup ariaLabel={copy.settings.savePolicyPage.optimistic.ariaLabel}>
          <V2NavRow
            as="div"
            label={copy.settings.savePolicyPage.optimistic.autoSync}
            description={
              autoSync.pending
                ? copy.settings.savePolicyPage.optimistic.autoSyncPending
                : autoSync.error
                  ? `${autoSync.error} ${copy.settings.savePolicyPage.optimistic.autoSyncErrorSuffix}`
                  : copy.settings.savePolicyPage.optimistic.autoSyncDescription
            }
            trailing={
              <V2Switch
                checked={Boolean(autoSync.value)}
                onCheckedChange={(next) => {
                  void autoSync.commit(next);
                }}
                disabled={autoSync.pending}
                aria-label={copy.settings.savePolicyPage.optimistic.autoSync}
              />
            }
          />
          <V2NavRow
            label={copy.settings.savePolicyPage.optimistic.timezone}
            description={mergeRowSubtitle(
              copy.settings.savePolicyPage.optimistic.timezoneSubtitle,
              timezone.pending
                ? copy.settings.savePolicyPage.optimistic.timezonePending
                : timezone.error
                  ? `${timezone.error} ${copy.settings.savePolicyPage.optimistic.timezoneErrorSuffix}`
                  : copy.settings.savePolicyPage.optimistic.timezoneDescription,
            )}
            value={timezone.value}
            onClick={() => {
              void timezone.commit(nextTimezone(String(timezone.value)));
            }}
            disabled={timezone.pending}
          />
          <V2NavRow
            as="div"
            label={copy.settings.savePolicyPage.optimistic.policy}
            description={copy.settings.savePolicyPage.optimistic.policyDescription}
            value={copy.settings.savePolicyPage.optimistic.standardized}
            trailing="none"
          />
        </V2SettingsGroup>
        <V2SettingsFootnote>{copy.settings.savePolicyPage.optimistic.footnote}</V2SettingsFootnote>
      </section>

      <section>
        <V2SettingsSection title={copy.settings.savePolicyPage.notice.title} />
        <NoticeStateRows
          message={latestNotice}
          tone={autoSync.error || timezone.error ? "warning" : "success"}
          label={autoSync.error || timezone.error ? copy.settings.savePolicyPage.notice.error : copy.settings.savePolicyPage.notice.success}
        />
        <V2SettingsFootnote>{copy.settings.savePolicyPage.notice.footnote}</V2SettingsFootnote>
      </section>
    </div>
  );
}
