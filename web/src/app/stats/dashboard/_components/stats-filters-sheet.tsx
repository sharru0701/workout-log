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
      <div>
        <Card tone="subtle" padding="sm" elevated={false}>
          <CardActionGroup>
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                onClose();
              }}
            >
              기본값으로 재설정
            </button>
            <button
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
          <CardContent>
            <AppSelect label="플랜" value={draft.planId} onChange={(event) => updateDraft("planId", event.target.value)}>
              <option value="">전체 플랜</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} [{plan.type}]
                </option>
              ))}
            </AppSelect>

            <AppSelect label="집계 단위" value={draft.bucket} onChange={(event) => updateDraft("bucket", event.target.value as "day" | "week" | "month")}>
              <option value="day">일</option>
              <option value="week">주</option>
              <option value="month">월</option>
            </AppSelect>
          </CardContent>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent>
            <label>
              <span>시작일(선택)</span>
              <AppTextInput type="date" value={draft.from} onChange={(event) => updateDraft("from", event.target.value)} />
            </label>
            <label>
              <span>종료일(선택)</span>
              <AppTextInput type="date" value={draft.to} onChange={(event) => updateDraft("to", event.target.value)} />
            </label>
          </CardContent>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent>
            <label>
              <span>e1RM exerciseId</span>
              <AppTextInput value={draft.exerciseId} onChange={(event) => updateDraft("exerciseId", event.target.value)} />
            </label>
            <label>
              <span>e1RM exercise</span>
              <AppTextInput value={draft.exercise} onChange={(event) => updateDraft("exercise", event.target.value)} />
            </label>
          </CardContent>
        </Card>
      </div>
    </BottomSheet>
  );
});

export default StatsFiltersSheet;
