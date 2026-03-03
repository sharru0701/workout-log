"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import { SETTINGS_KEYS } from "@/lib/settings/workout-preferences";

const MIN_BODYWEIGHT_KG = 20;
const MAX_BODYWEIGHT_KG = 300;
const DEFAULT_BODYWEIGHT_KG = 70;

function normalizeBodyweightKg(value: number) {
  const clipped = Math.max(MIN_BODYWEIGHT_KG, Math.min(MAX_BODYWEIGHT_KG, value));
  return Math.round(clipped * 10) / 10;
}

export default function SettingsBodyweightPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverBodyweightKg, setServerBodyweightKg] = useState(DEFAULT_BODYWEIGHT_KG);
  const [draftBodyweightKg, setDraftBodyweightKg] = useState(DEFAULT_BODYWEIGHT_KG);

  const bodyweight = useSettingRowMutation<number>({
    key: SETTINGS_KEYS.bodyweightKg,
    fallbackValue: DEFAULT_BODYWEIGHT_KG,
    serverValue: serverBodyweightKg,
    persistServer: createPersistServerSetting<number>(),
    successMessage: "몸무게를 저장했습니다.",
    rollbackNotice: "몸무게 저장 실패로 이전 값으로 되돌렸습니다.",
  });

  const loadBodyweight = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const snapshot = await fetchSettingsSnapshot();
      const parsed = Number(snapshot[SETTINGS_KEYS.bodyweightKg]);
      const resolved = normalizeBodyweightKg(Number.isFinite(parsed) ? parsed : DEFAULT_BODYWEIGHT_KG);
      setServerBodyweightKg(resolved);
      setDraftBodyweightKg(resolved);
    } catch (e: any) {
      setLoadError(e?.message ?? "몸무게 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBodyweight();
  }, [loadBodyweight]);

  useEffect(() => {
    if (bodyweight.pending) return;
    setDraftBodyweightKg(normalizeBodyweightKg(bodyweight.value));
  }, [bodyweight.pending, bodyweight.value]);

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={120}
        label="몸무게 설정 로딩 중"
        description="현재 저장된 몸무게를 확인하고 있습니다."
      />
      <ErrorStateRows
        message={loadError}
        title="몸무게 설정 조회 실패"
        onRetry={() => {
          void loadBodyweight();
        }}
      />
      <NoticeStateRows message={bodyweight.notice} tone={bodyweight.error ? "warning" : "success"} label="몸무게 안내" />

      <section className="grid gap-2">
        <SectionHeader title="몸무게 입력" description="중량 풀업 등 몸무게 연관 종목 계산/표시에 사용" />
        <BaseGroupedList ariaLabel="Bodyweight setting">
          <ValueRow
            label="현재 몸무게"
            description="저장된 값"
            value={`${bodyweight.value.toFixed(1)} kg`}
            showChevron={false}
            leading={<RowIcon symbol="BW" tone="green" />}
          />
          <NavigationRow
            label="몸무게 -0.5kg"
            description="스텝으로 빠르게 조절"
            onPress={() => setDraftBodyweightKg((prev) => normalizeBodyweightKg(prev - 0.5))}
            showChevron={false}
            leading={<RowIcon symbol="-0.5" tone="neutral" />}
          />
          <NavigationRow
            label="몸무게 +0.5kg"
            description="스텝으로 빠르게 조절"
            onPress={() => setDraftBodyweightKg((prev) => normalizeBodyweightKg(prev + 0.5))}
            showChevron={false}
            leading={<RowIcon symbol="+0.5" tone="neutral" />}
          />
        </BaseGroupedList>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="수동 입력" description="숫자 키패드로 직접 수정할 수 있습니다." />
        <article className="motion-card rounded-2xl border p-4 grid gap-3">
          <label className="grid gap-1">
            <span className="ui-card-label">Bodyweight (kg)</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              min={MIN_BODYWEIGHT_KG}
              max={MAX_BODYWEIGHT_KG}
              step={0.1}
              value={draftBodyweightKg}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setDraftBodyweightKg(normalizeBodyweightKg(next));
              }}
            />
          </label>
          <button
            type="button"
            className="ui-primary-button"
            disabled={bodyweight.pending}
            onClick={() => {
              void bodyweight.commit(normalizeBodyweightKg(draftBodyweightKg));
            }}
          >
            {bodyweight.pending ? "저장 중..." : "몸무게 저장"}
          </button>
        </article>
        <SectionFootnote>
          저장된 몸무게는 Workout Record에서 중량 풀업 계열 종목의 총 부하(외부중량 + 몸무게) 계산에 사용됩니다.
        </SectionFootnote>
      </section>
    </div>
  );
}
