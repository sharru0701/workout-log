"use client";

import { memo, useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardActionGroup, CardContent } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";

type PlanOption = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
};

export type StatsFilterValues = {
  planId: string;
  bucket: "day" | "week" | "month";
  from: string;
  to: string;
  exerciseId: string;
  exercise: string;
};

type StatsFiltersSheetProps = {
  open: boolean;
  plans: PlanOption[];
  value: StatsFilterValues;
  onClose: () => void;
  onApply: (value: StatsFilterValues) => void;
  onResetFilters: () => void;
};

const StatsFiltersSheet = memo(function StatsFiltersSheet({
  open,
  plans,
  value,
  onClose,
  onApply,
  onResetFilters,
}: StatsFiltersSheetProps) {
  const [draft, setDraft] = useState<StatsFilterValues>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  function updateDraft<Key extends keyof StatsFilterValues>(key: Key, nextValue: StatsFilterValues[Key]) {
    setDraft((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="통계 필터" description="범위를 정하고 추세 구간을 비교합니다.">
      <div className="space-y-4 pb-2">
        <Card tone="subtle" padding="sm" elevated={false}>
          <CardActionGroup className="grid-cols-1 sm:grid-cols-2">
            <button
              className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium"
              type="button"
              onClick={() => {
                onResetFilters();
                onClose();
              }}
            >
              기본값으로 재설정
            </button>
            <button
              className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium"
              type="button"
              onClick={() => {
                onApply({
                  ...draft,
                  exerciseId: draft.exerciseId.trim(),
                  exercise: draft.exercise.trim(),
                });
                onClose();
              }}
            >
              적용
            </button>
          </CardActionGroup>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">플랜</span>
              <AppSelect value={draft.planId} onChange={(event) => updateDraft("planId", event.target.value)}>
                <option value="">전체 플랜</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} [{plan.type}]
                  </option>
                ))}
              </AppSelect>
            </label>

            <label className="flex flex-col gap-1">
              <span className="ui-card-label">집계 단위</span>
              <AppSelect value={draft.bucket} onChange={(event) => updateDraft("bucket", event.target.value as "day" | "week" | "month")}>
                <option value="day">일</option>
                <option value="week">주</option>
                <option value="month">월</option>
              </AppSelect>
            </label>
          </CardContent>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">시작일(선택)</span>
              <AppTextInput type="date" value={draft.from} onChange={(event) => updateDraft("from", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">종료일(선택)</span>
              <AppTextInput type="date" value={draft.to} onChange={(event) => updateDraft("to", event.target.value)} />
            </label>
          </CardContent>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exerciseId</span>
              <AppTextInput value={draft.exerciseId} onChange={(event) => updateDraft("exerciseId", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exercise</span>
              <AppTextInput value={draft.exercise} onChange={(event) => updateDraft("exercise", event.target.value)} />
            </label>
          </CardContent>
        </Card>
      </div>
    </BottomSheet>
  );
});

export default StatsFiltersSheet;
