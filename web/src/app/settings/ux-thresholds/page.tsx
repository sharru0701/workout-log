"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  BaseGroupedList,
  InfoRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";

const DEFAULT_TARGETS = {
  saveFromGenerate: 0.65,
  saveSuccessFromClicks7d: 0.6,
  addAfterSheetOpen14d: 0.35,
};

type ThresholdField = keyof typeof DEFAULT_TARGETS;

type Plan = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
};

const SAVE_FROM_GENERATE_OPTIONS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8] as const;
const SAVE_SUCCESS_FROM_CLICKS_7D_OPTIONS = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75] as const;
const ADD_AFTER_SHEET_OPEN_14D_OPTIONS = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5] as const;

function formatPercentRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

function nextOption(current: number, options: readonly number[], fallback: number) {
  const currentIndex = options.findIndex((option) => Math.abs(option - current) < 1e-9);
  if (currentIndex < 0) return fallback;
  return options[(currentIndex + 1) % options.length];
}

function clampRatio(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.05, Math.min(0.99, value));
}

function parseNumberSetting(value: unknown, fallback: number) {
  if (typeof value === "number") return clampRatio(value, fallback);
  return fallback;
}

function planThresholdKey(planId: string, field: ThresholdField) {
  return `prefs.uxThreshold.plan.${planId}.${field}`;
}

export default function SettingsUxThresholdsPage() {
  const persistNumberSetting = useMemo(() => createPersistServerSetting<number>(), []);
  const persistNullableNumberSetting = useMemo(() => createPersistServerSetting<number | null>(), []);

  const saveFromGenerate = useSettingRowMutation<number>({
    key: "prefs.uxThreshold.saveFromGenerate",
    fallbackValue: DEFAULT_TARGETS.saveFromGenerate,
    persistServer: persistNumberSetting,
    successMessage: "생성→저장 기준치를 저장했습니다.",
    rollbackNotice: "생성→저장 기준치 저장에 실패해 이전 값으로 복구했습니다.",
  });

  const saveSuccessFromClicks7d = useSettingRowMutation<number>({
    key: "prefs.uxThreshold.saveSuccessFromClicks7d",
    fallbackValue: DEFAULT_TARGETS.saveSuccessFromClicks7d,
    persistServer: persistNumberSetting,
    successMessage: "7일 저장 성공률 기준치를 저장했습니다.",
    rollbackNotice: "7일 저장 성공률 기준치 저장에 실패해 이전 값으로 복구했습니다.",
  });

  const addAfterSheetOpen14d = useSettingRowMutation<number>({
    key: "prefs.uxThreshold.addAfterSheetOpen14d",
    fallbackValue: DEFAULT_TARGETS.addAfterSheetOpen14d,
    persistServer: persistNumberSetting,
    successMessage: "14일 운동 추가 전환 기준치를 저장했습니다.",
    rollbackNotice: "14일 운동 추가 전환 기준치 저장에 실패해 이전 값으로 복구했습니다.",
  });

  const globalTargets = useMemo(
    () => ({
      saveFromGenerate: clampRatio(Number(saveFromGenerate.value), DEFAULT_TARGETS.saveFromGenerate),
      saveSuccessFromClicks7d: clampRatio(
        Number(saveSuccessFromClicks7d.value),
        DEFAULT_TARGETS.saveSuccessFromClicks7d,
      ),
      addAfterSheetOpen14d: clampRatio(
        Number(addAfterSheetOpen14d.value),
        DEFAULT_TARGETS.addAfterSheetOpen14d,
      ),
    }),
    [addAfterSheetOpen14d.value, saveFromGenerate.value, saveSuccessFromClicks7d.value],
  );

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planTargets, setPlanTargets] = useState(globalTargets);
  const [planPendingField, setPlanPendingField] = useState<ThresholdField | "clear" | null>(null);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const hasGlobalError = Boolean(
    saveFromGenerate.error || saveSuccessFromClicks7d.error || addAfterSheetOpen14d.error,
  );
  const latestNotice =
    saveFromGenerate.notice ?? saveSuccessFromClicks7d.notice ?? addAfterSheetOpen14d.notice ?? planNotice;
  const hasError = hasGlobalError || Boolean(planError);
  const isAnyGlobalPending =
    saveFromGenerate.pending || saveSuccessFromClicks7d.pending || addAfterSheetOpen14d.pending;

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const reloadPlanTargets = useCallback(async (planId: string, fallback = globalTargets) => {
    if (!planId) {
      setPlanTargets(fallback);
      return;
    }

    try {
      const snapshot = await fetchSettingsSnapshot();
      const nextTargets = {
        saveFromGenerate: parseNumberSetting(
          snapshot[planThresholdKey(planId, "saveFromGenerate")],
          fallback.saveFromGenerate,
        ),
        saveSuccessFromClicks7d: parseNumberSetting(
          snapshot[planThresholdKey(planId, "saveSuccessFromClicks7d")],
          fallback.saveSuccessFromClicks7d,
        ),
        addAfterSheetOpen14d: parseNumberSetting(
          snapshot[planThresholdKey(planId, "addAfterSheetOpen14d")],
          fallback.addAfterSheetOpen14d,
        ),
      };
      setPlanTargets(nextTargets);
      setPlanError(null);
    } catch {
      setPlanTargets(fallback);
      setPlanError("플랜별 기준치를 불러오지 못해 기본 기준치를 표시합니다.");
    }
  }, [globalTargets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setSelectedPlanId((prev) => {
          if (prev && res.items.some((plan) => plan.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch {
        if (cancelled) return;
        setPlans([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void reloadPlanTargets(selectedPlanId, globalTargets);
  }, [globalTargets, reloadPlanTargets, selectedPlanId]);

  async function resetDefaults() {
    await Promise.all([
      saveFromGenerate.commit(DEFAULT_TARGETS.saveFromGenerate),
      saveSuccessFromClicks7d.commit(DEFAULT_TARGETS.saveSuccessFromClicks7d),
      addAfterSheetOpen14d.commit(DEFAULT_TARGETS.addAfterSheetOpen14d),
    ]);
  }

  async function commitPlanTarget(field: ThresholdField, nextValue: number) {
    if (!selectedPlanId || planPendingField) return;
    setPlanPendingField(field);
    setPlanNotice(null);
    setPlanError(null);

    try {
      await persistNullableNumberSetting({
        key: planThresholdKey(selectedPlanId, field),
        value: nextValue,
        previousValue: planTargets[field],
      });
      setPlanTargets((prev) => ({ ...prev, [field]: nextValue }));
      setPlanNotice("플랜별 기준치를 저장했습니다.");
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "플랜별 기준치 저장에 실패했습니다.");
      void reloadPlanTargets(selectedPlanId, globalTargets);
    } finally {
      setPlanPendingField(null);
    }
  }

  async function clearPlanOverrides() {
    if (!selectedPlanId || planPendingField) return;
    setPlanPendingField("clear");
    setPlanNotice(null);
    setPlanError(null);

    try {
      await Promise.all([
        persistNullableNumberSetting({
          key: planThresholdKey(selectedPlanId, "saveFromGenerate"),
          value: null,
          previousValue: planTargets.saveFromGenerate,
        }),
        persistNullableNumberSetting({
          key: planThresholdKey(selectedPlanId, "saveSuccessFromClicks7d"),
          value: null,
          previousValue: planTargets.saveSuccessFromClicks7d,
        }),
        persistNullableNumberSetting({
          key: planThresholdKey(selectedPlanId, "addAfterSheetOpen14d"),
          value: null,
          previousValue: planTargets.addAfterSheetOpen14d,
        }),
      ]);
      setPlanTargets(globalTargets);
      setPlanNotice("플랜별 기준치를 해제했습니다. 글로벌 기준치를 사용합니다.");
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "플랜별 기준치 해제에 실패했습니다.");
      void reloadPlanTargets(selectedPlanId, globalTargets);
    } finally {
      setPlanPendingField(null);
    }
  }

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <ScreenTitleCard title="UX 기준치" note="대시보드 UX 임계치를 팀 정책에 맞게 조정하세요." />

      <section className="grid gap-2">
        <SectionHeader title="글로벌 기준치" />
        <BaseGroupedList ariaLabel="UX threshold settings">
          <ValueRow
            rowId="row-target-save-from-generate"
            label="세션 생성→저장 전환율 목표"
            subtitle="탭해서 순환"
            description={
              saveFromGenerate.pending
                ? "저장 중..."
                : saveFromGenerate.error
                  ? `${saveFromGenerate.error} 이전 값으로 복구됨.`
                  : "생성 후 저장 전환 최소 기준치"
            }
            value={formatPercentRatio(Number(saveFromGenerate.value))}
            onPress={() =>
              void saveFromGenerate.commit(
                nextOption(
                  Number(saveFromGenerate.value),
                  SAVE_FROM_GENERATE_OPTIONS,
                  DEFAULT_TARGETS.saveFromGenerate,
                ),
              )
            }
            disabled={saveFromGenerate.pending}
            leading={<RowIcon symbol="F1" tone="green" />}
          />

          <ValueRow
            rowId="row-target-save-success-clicks-7d"
            label="7일 저장 클릭→성공율 목표"
            subtitle="탭해서 순환"
            description={
              saveSuccessFromClicks7d.pending
                ? "저장 중..."
                : saveSuccessFromClicks7d.error
                  ? `${saveSuccessFromClicks7d.error} 이전 값으로 복구됨.`
                  : "7일 저장 성공 안정성 기준치"
            }
            value={formatPercentRatio(Number(saveSuccessFromClicks7d.value))}
            onPress={() =>
              void saveSuccessFromClicks7d.commit(
                nextOption(
                  Number(saveSuccessFromClicks7d.value),
                  SAVE_SUCCESS_FROM_CLICKS_7D_OPTIONS,
                  DEFAULT_TARGETS.saveSuccessFromClicks7d,
                ),
              )
            }
            disabled={saveSuccessFromClicks7d.pending}
            leading={<RowIcon symbol="F2" tone="blue" />}
          />

          <ValueRow
            rowId="row-target-add-after-sheet-open-14d"
            label="14일 시트 오픈→운동 추가율 목표"
            subtitle="탭해서 순환"
            description={
              addAfterSheetOpen14d.pending
                ? "저장 중..."
                : addAfterSheetOpen14d.error
                  ? `${addAfterSheetOpen14d.error} 이전 값으로 복구됨.`
                  : "운동 추가 플로우 전환 기준치"
            }
            value={formatPercentRatio(Number(addAfterSheetOpen14d.value))}
            onPress={() =>
              void addAfterSheetOpen14d.commit(
                nextOption(
                  Number(addAfterSheetOpen14d.value),
                  ADD_AFTER_SHEET_OPEN_14D_OPTIONS,
                  DEFAULT_TARGETS.addAfterSheetOpen14d,
                ),
              )
            }
            disabled={addAfterSheetOpen14d.pending}
            leading={<RowIcon symbol="F3" tone="orange" />}
          />

          <ValueRow
            rowId="row-target-reset-default"
            label="기본값 복원"
            description="권장 기본 기준치(65%, 60%, 35%)로 되돌립니다."
            value={isAnyGlobalPending ? "저장 중..." : "복원"}
            onPress={() => void resetDefaults()}
            disabled={isAnyGlobalPending}
            leading={<RowIcon symbol="DF" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>글로벌 기준치는 모든 플랜에 기본으로 적용됩니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="플랜별 기준치 프로필(선택)" />
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="ui-card-label">플랜 선택</span>
            <select
              className="rounded-lg border px-3 py-2"
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
            >
              {plans.length === 0 && <option value="">(플랜 없음)</option>}
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} [{plan.type}]
                </option>
              ))}
            </select>
          </label>

          <BaseGroupedList ariaLabel="Plan threshold settings">
            <ValueRow
              rowId="row-plan-target-save-from-generate"
              label="생성→저장 전환율"
              description="선택된 플랜에만 적용되는 목표"
              value={formatPercentRatio(planTargets.saveFromGenerate)}
              onPress={() =>
                void commitPlanTarget(
                  "saveFromGenerate",
                  nextOption(
                    planTargets.saveFromGenerate,
                    SAVE_FROM_GENERATE_OPTIONS,
                    globalTargets.saveFromGenerate,
                  ),
                )
              }
              disabled={!selectedPlanId || Boolean(planPendingField)}
              leading={<RowIcon symbol="P1" tone="green" />}
            />
            <ValueRow
              rowId="row-plan-target-save-success-clicks-7d"
              label="7일 저장 클릭→성공율"
              description="선택된 플랜에만 적용되는 목표"
              value={formatPercentRatio(planTargets.saveSuccessFromClicks7d)}
              onPress={() =>
                void commitPlanTarget(
                  "saveSuccessFromClicks7d",
                  nextOption(
                    planTargets.saveSuccessFromClicks7d,
                    SAVE_SUCCESS_FROM_CLICKS_7D_OPTIONS,
                    globalTargets.saveSuccessFromClicks7d,
                  ),
                )
              }
              disabled={!selectedPlanId || Boolean(planPendingField)}
              leading={<RowIcon symbol="P2" tone="blue" />}
            />
            <ValueRow
              rowId="row-plan-target-add-after-sheet-open-14d"
              label="14일 시트→운동 추가율"
              description="선택된 플랜에만 적용되는 목표"
              value={formatPercentRatio(planTargets.addAfterSheetOpen14d)}
              onPress={() =>
                void commitPlanTarget(
                  "addAfterSheetOpen14d",
                  nextOption(
                    planTargets.addAfterSheetOpen14d,
                    ADD_AFTER_SHEET_OPEN_14D_OPTIONS,
                    globalTargets.addAfterSheetOpen14d,
                  ),
                )
              }
              disabled={!selectedPlanId || Boolean(planPendingField)}
              leading={<RowIcon symbol="P3" tone="orange" />}
            />
            <ValueRow
              rowId="row-plan-target-clear"
              label="플랜 오버라이드 해제"
              description="선택된 플랜을 글로벌 기준치로 되돌립니다."
              value={planPendingField === "clear" ? "해제 중..." : "해제"}
              onPress={() => void clearPlanOverrides()}
              disabled={!selectedPlanId || Boolean(planPendingField)}
              leading={<RowIcon symbol="CL" tone="neutral" />}
            />
          </BaseGroupedList>

          <div className="text-xs text-neutral-600">
            현재 플랜: {selectedPlan ? `${selectedPlan.name} [${selectedPlan.type}]` : "선택되지 않음"}
          </div>
        </div>
        <SectionFootnote>
          플랜별 값을 저장하면 해당 플랜으로 통계 조회할 때만 임계치가 덮어써집니다.
        </SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="적용 안내" />
        <NoticeStateRows
          message={latestNotice}
          tone={hasError ? "warning" : "success"}
          label={hasError ? "저장 실패" : "저장 완료"}
        />
        <BaseGroupedList ariaLabel="UX threshold notes">
          <InfoRow
            rowId="row-threshold-note"
            label="대상 화면"
            description="통계 대시보드 > UX 행동 요약"
            value="연동됨"
            leading={<RowIcon symbol="UX" tone="tint" />}
            tone="neutral"
          />
        </BaseGroupedList>
      </section>
    </div>
  );
}
