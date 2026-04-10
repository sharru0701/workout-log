"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { useLocale } from "@/components/locale-provider";
import { createPersistServerSetting } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import { SETTINGS_KEYS } from "@/lib/settings/workout-preferences";
import { AppNumberStepper } from "@/components/ui/form-controls";
import type { SettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";

const MIN_BODYWEIGHT_KG = 20;
const MAX_BODYWEIGHT_KG = 300;
const DEFAULT_BODYWEIGHT_KG = 70;

function normalizeBodyweightKg(value: number) {
  const clipped = Math.max(MIN_BODYWEIGHT_KG, Math.min(MAX_BODYWEIGHT_KG, value));
  return Math.round(clipped * 10) / 10;
}

export function BodyweightPageContent({ initialSnapshot }: { initialSnapshot: SettingsSnapshot }) {
  const { locale } = useLocale();

  const initialKg = (() => {
    const parsed = Number(initialSnapshot[SETTINGS_KEYS.bodyweightKg]);
    return normalizeBodyweightKg(Number.isFinite(parsed) ? parsed : DEFAULT_BODYWEIGHT_KG);
  })();

  const [serverBodyweightKg, setServerBodyweightKg] = useState(initialKg);
  const [draftBodyweightKg, setDraftBodyweightKg] = useState(initialKg);

  const bodyweight = useSettingRowMutation<number>({
    key: SETTINGS_KEYS.bodyweightKg,
    fallbackValue: DEFAULT_BODYWEIGHT_KG,
    serverValue: serverBodyweightKg,
    persistServer: createPersistServerSetting<number>(),
    successMessage: locale === "ko" ? "몸무게를 저장했습니다." : "Saved bodyweight.",
    rollbackNotice: locale === "ko" ? "몸무게 저장 실패로 이전 값으로 되돌렸습니다." : "Failed to save bodyweight, so the previous value was restored.",
  });

  useEffect(() => {
    if (bodyweight.pending) return;
    setDraftBodyweightKg(normalizeBodyweightKg(bodyweight.value));
  }, [bodyweight.pending, bodyweight.value]);

  const normalizedDraftBodyweightKg = normalizeBodyweightKg(draftBodyweightKg);
  const canSaveBodyweight = !bodyweight.pending && normalizedDraftBodyweightKg !== normalizeBodyweightKg(bodyweight.value);

  const saveBodyweight = useCallback(async () => {
    const result = await bodyweight.commit(normalizedDraftBodyweightKg);
    if (!result.ignored && result.ok) {
      setServerBodyweightKg(result.value);
      setDraftBodyweightKg(normalizeBodyweightKg(result.value));
    }
  }, [bodyweight, normalizedDraftBodyweightKg]);

  return (
    <div>
      <NoticeStateRows
        message={bodyweight.notice}
        tone={bodyweight.error ? "warning" : "success"}
        label={locale === "ko" ? "몸무게 안내" : "Bodyweight Notice"}
      />

      <section>
        <SectionHeader
          title={locale === "ko" ? "몸무게 입력" : "Bodyweight"}
          description={locale === "ko" ? "스테퍼로 조절한 뒤 저장 버튼으로 반영합니다." : "Adjust the value with the stepper, then save it."}
        />
        <div style={{ background: "var(--color-surface-container-low)", borderRadius: 20, padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <AppNumberStepper
            label="Bodyweight (kg)"
            value={draftBodyweightKg}
            min={MIN_BODYWEIGHT_KG}
            max={MAX_BODYWEIGHT_KG}
            step={0.1}
            inputMode="decimal"
            onChange={(next) => setDraftBodyweightKg(normalizeBodyweightKg(next))}
          />
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => {
              void saveBodyweight();
            }}
            disabled={!canSaveBodyweight}
          >
            {bodyweight.pending ? (locale === "ko" ? "저장 중..." : "Saving...") : (locale === "ko" ? "몸무게 저장" : "Save Bodyweight")}
          </button>
        </div>
        <SectionFootnote>
          {locale === "ko"
            ? "저장된 몸무게는 기록 화면에서 중량 풀업 계열 종목의 총 부하(외부중량 + 몸무게) 계산에 사용됩니다."
            : "Saved bodyweight is used to calculate total load (external load + bodyweight) for weighted pull-up style movements in the logging screen."}
        </SectionFootnote>
      </section>
    </div>
  );
}
