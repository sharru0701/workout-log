"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import { PickerSelectionScreen } from "@/components/ui/selection-screen-template";
import { normalizeReturnTo, readParamFromHref, withPatchedQuery } from "@/lib/selection-navigation";

type PickerField = "start-date" | "week" | "day";

type PickerConfig = {
  title: string;
  sectionTitle: string;
  sectionFootnote: string;
  inputLabel: string;
  inputType: "date" | "time" | "number";
  paramKey: string;
  defaultValue: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
};

const configs: Record<PickerField, PickerConfig> = {
  "start-date": {
    title: "시작 날짜",
    sectionTitle: "날짜",
    sectionFootnote: "기준 날짜를 정하면 생성 컨텍스트에 바로 반영됩니다.",
    inputLabel: "시작 날짜",
    inputType: "date",
    paramKey: "startDate",
    defaultValue: new Date().toISOString().slice(0, 10),
  },
  week: {
    title: "주차",
    sectionTitle: "숫자",
    sectionFootnote: "주차는 1부터 시작합니다.",
    inputLabel: "주차",
    inputType: "number",
    paramKey: "week",
    defaultValue: "1",
    min: 1,
    max: 52,
    step: 1,
  },
  day: {
    title: "일차",
    sectionTitle: "숫자",
    sectionFootnote: "일차는 1부터 시작합니다.",
    inputLabel: "일차",
    inputType: "number",
    paramKey: "day",
    defaultValue: "1",
    min: 1,
    max: 14,
    step: 1,
  },
};

export default function PlansContextPickerFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");
  const config = useMemo(() => configs[rawField as PickerField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/plans/context");
  const safeConfig = config ?? configs.week;
  const initial = readParamFromHref(returnTo, safeConfig.paramKey, safeConfig.defaultValue);
  const [value, setValue] = useState(initial);

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown picker field: ${rawField}`}
          onRetry={() => router.push("/plans/context")}
          retryLabel="컨텍스트로 돌아가기"
        />
      </div>
    );
  }

  return (
    <PickerSelectionScreen
      title={config.title}
      sectionTitle={config.sectionTitle}
      sectionFootnote={config.sectionFootnote}
      inputLabel={config.inputLabel}
      inputType={config.inputType}
      value={value}
      min={config.min}
      max={config.max}
      step={config.step}
      onValueChange={setValue}
      onApply={() => {
        const next =
          config.inputType === "number"
            ? String(Math.max(1, Math.floor(Number(value) || Number(config.defaultValue) || 1)))
            : value || config.defaultValue;
        router.push(withPatchedQuery(returnTo, { [config.paramKey]: next }));
      }}
    />
  );
}
