"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BaseGroupedList,
  InfoRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ToggleRow,
  ValueRow,
} from "@/components/ui/settings-list";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { createPersistServerSetting } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";

const TIMEZONE_OPTIONS = ["UTC", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "Europe/London"] as const;

function nextTimezone(current: string) {
  const currentIndex = TIMEZONE_OPTIONS.indexOf(current as (typeof TIMEZONE_OPTIONS)[number]);
  if (currentIndex < 0) return TIMEZONE_OPTIONS[0];
  return TIMEZONE_OPTIONS[(currentIndex + 1) % TIMEZONE_OPTIONS.length];
}

export default function SettingsSavePolicyPage() {
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
    successMessage: "자동 동기화 설정을 저장했습니다.",
    rollbackNotice: "자동 동기화 저장에 실패해 이전 값으로 복구했습니다.",
  });

  const timezone = useSettingRowMutation<string>({
    key: "prefs.timezone",
    fallbackValue: "UTC",
    persistServer: persistTimezone,
    successMessage: "시간대 설정을 저장했습니다.",
    rollbackNotice: "시간대 저장에 실패해 이전 값으로 복구했습니다.",
  });

  const latestNotice = useMemo(() => {
    if (autoSync.notice) return autoSync.notice;
    if (timezone.notice) return timezone.notice;
    return null;
  }, [autoSync.notice, timezone.notice]);

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="실패 시뮬레이션" />
        <BaseGroupedList ariaLabel="Save failure simulation">
          <ToggleRow
            rowId="row-fail-next-save"
            label="다음 저장 실패"
            description="테스트용: 다음 저장 1회를 실패 처리."
            checked={simulateFailureOnNextSave}
            onCheckedChange={setSimulateFailureOnNextSave}
            leading={<RowIcon symbol="FT" tone="orange" />}
            badge={simulateFailureOnNextSave ? "!" : undefined}
            badgeTone="warning"
          />
        </BaseGroupedList>
        <SectionFootnote>한 번만 실패 처리한 뒤 같은 Row에서 다시 시도하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="즉시 반영 설정" />
        <BaseGroupedList ariaLabel="Optimistic settings rows">
          <ToggleRow
            rowId="row-auto-sync"
            label="자동 동기화"
            description={
              autoSync.pending
                ? "저장 중..."
                : autoSync.error
                  ? `${autoSync.error} 이전 값으로 복구됨.`
                  : "변경 즉시 반영 후 서버에 저장합니다."
            }
            checked={Boolean(autoSync.value)}
            onCheckedChange={(next) => {
              void autoSync.commit(next);
            }}
            disabled={autoSync.pending}
            leading={<RowIcon symbol="SY" tone="green" />}
          />
          <ValueRow
            rowId="row-timezone"
            label="시간대"
            subtitle="탭해서 순환"
            description={
              timezone.pending
                ? "저장 중..."
                : timezone.error
                  ? `${timezone.error} 이전 값으로 복구됨.`
                  : "탭하면 다음 시간대로 저장합니다."
            }
            value={timezone.value}
            onPress={() => {
              void timezone.commit(nextTimezone(String(timezone.value)));
            }}
            disabled={timezone.pending}
            leading={<RowIcon symbol="TZ" tone="blue" />}
          />
          <InfoRow
            rowId="row-policy"
            label="정책"
            description="즉시 반영, 행 잠금, 롤백 규칙을 적용합니다."
            value="표준화됨"
            leading={<RowIcon symbol="OK" tone="green" />}
            tone="success"
          />
        </BaseGroupedList>
        <SectionFootnote>전체 로딩 오버레이 없이, 저장 중인 Row만 잠급니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="인라인 안내" />
        <NoticeStateRows
          message={latestNotice}
          tone={autoSync.error || timezone.error ? "warning" : "success"}
          label={autoSync.error || timezone.error ? "저장 실패" : "저장 완료"}
        />
        <SectionFootnote>실패 시 안내 문구를 확인한 뒤 같은 Row에서 다시 시도하세요.</SectionFootnote>
      </section>
    </div>
  );
}
