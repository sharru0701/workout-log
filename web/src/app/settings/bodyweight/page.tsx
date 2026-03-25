"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { Card, CardContent } from "@/components/ui/card";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import { SETTINGS_KEYS } from "@/lib/settings/workout-preferences";
import { AppNumberStepper } from "@/components/ui/form-controls";

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
  const hasLoadedRef = useRef(false);

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
      if (!hasLoadedRef.current) setLoading(true);
      setLoadError(null);
      const snapshot = await fetchSettingsSnapshot();
      const parsed = Number(snapshot[SETTINGS_KEYS.bodyweightKg]);
      const resolved = normalizeBodyweightKg(Number.isFinite(parsed) ? parsed : DEFAULT_BODYWEIGHT_KG);
      hasLoadedRef.current = true;
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
      {loading && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "45%", marginBottom: 4 }} />
          <div className="card" style={{ padding: "var(--space-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 12 }}>
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 14, width: "35%" }} />
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 36, width: 120 }} />
            </div>
          </div>
          <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 44 }} />
        </div>
      )}
      <ErrorStateRows
        message={loadError}
        title="몸무게 설정 조회 실패"
        onRetry={() => {
          void loadBodyweight();
        }}
      />
      <NoticeStateRows message={bodyweight.notice} tone={bodyweight.error ? "warning" : "success"} label="몸무게 안내" />

      <section>
        <SectionHeader title="몸무게 입력" description="스테퍼로 조절한 뒤 저장 버튼으로 반영합니다." />
        <Card padding="md" elevated={false}>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
              {bodyweight.pending ? "저장 중..." : "몸무게 저장"}
            </button>
          </CardContent>
        </Card>
        <SectionFootnote>
          저장된 몸무게는 기록 화면에서 중량 풀업 계열 종목의 총 부하(외부중량 + 몸무게) 계산에 사용됩니다.
        </SectionFootnote>
      </section>
    </div>
  );
}
