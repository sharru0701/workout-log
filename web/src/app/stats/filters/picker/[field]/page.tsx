"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import { PickerSelectionScreen } from "@/components/ui/selection-screen-template";
import { normalizeReturnTo, readParamFromHref, withPatchedQuery } from "@/lib/selection-navigation";

type PickerField = "days" | "from" | "to";

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
  days: {
    title: "기본 일수",
    sectionTitle: "숫자",
    sectionFootnote: "대시보드 기본 조회 범위를 설정합니다.",
    inputLabel: "일수",
    inputType: "number",
    paramKey: "days",
    defaultValue: "90",
    min: 1,
    max: 365,
    step: 1,
  },
  from: {
    title: "시작일",
    sectionTitle: "날짜",
    sectionFootnote: "비워 두면 기본 일수 기준을 사용합니다.",
    inputLabel: "시작일",
    inputType: "date",
    paramKey: "from",
    defaultValue: "",
  },
  to: {
    title: "종료일",
    sectionTitle: "날짜",
    sectionFootnote: "비워 두면 오늘을 종료일로 사용합니다.",
    inputLabel: "종료일",
    inputType: "date",
    paramKey: "to",
    defaultValue: "",
  },
};

export default function StatsFiltersPickerFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");
  const config = useMemo(() => configs[rawField as PickerField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/stats/filters");
  const safeConfig = config ?? configs.days;
  const [value, setValue] = useState(
    readParamFromHref(returnTo, safeConfig.paramKey, safeConfig.defaultValue),
  );

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown picker field: ${rawField}`}
          onRetry={() => router.push("/stats/filters")}
          retryLabel="필터로 돌아가기"
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
            : value;
        router.push(withPatchedQuery(returnTo, { [config.paramKey]: next }));
      }}
      applyDescription="입력값 저장 후 이전 화면으로 이동합니다."
    />
  );
}
