"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import {
  MultiSelectionScreen,
  SingleSelectionScreen,
  type SelectionOption,
} from "@/components/ui/selection-screen-template";
import {
  commonExerciseOptions,
  statsMetricOptions,
  statsPlanScopeOptions,
} from "@/lib/selection-options";
import {
  normalizeReturnTo,
  parseCsvParam,
  readParamFromHref,
  toCsvParam,
  withPatchedQuery,
} from "@/lib/selection-navigation";

type SelectField = "plan-scope" | "bucket" | "exercise" | "metrics";

type FieldConfig = {
  title: string;
  sectionTitle: string;
  sectionFootnote: string;
  paramKey: string;
  defaultValue: string;
  searchable?: boolean;
  multi?: boolean;
  options: SelectionOption[];
};

const configs: Record<SelectField, FieldConfig> = {
  "plan-scope": {
    title: "플랜 필터",
    sectionTitle: "플랜 범위",
    sectionFootnote: "하나를 선택하면 바로 적용됩니다.",
    paramKey: "planScope",
    defaultValue: "all",
    options: statsPlanScopeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    })),
  },
  bucket: {
    title: "집계 단위",
    sectionTitle: "단위",
    sectionFootnote: "가독성을 위해 week를 권장합니다.",
    paramKey: "bucket",
    defaultValue: "week",
    options: [
      { value: "day", label: "day", description: "일 단위 추세를 봅니다." },
      { value: "week", label: "week", description: "주 단위로 균형 있게 봅니다." },
      { value: "month", label: "month", description: "월 단위 큰 흐름을 봅니다." },
    ],
  },
  exercise: {
    title: "운동 필터",
    sectionTitle: "운동 목록",
    sectionFootnote: "검색으로 항목을 좁힌 뒤 선택하세요.",
    paramKey: "exercise",
    defaultValue: "Back Squat",
    searchable: true,
    options: commonExerciseOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
      keywords: option.keywords,
    })),
  },
  metrics: {
    title: "지표",
    sectionTitle: "지표 섹션",
    sectionFootnote: "여러 항목을 고른 뒤 적용을 누르세요.",
    paramKey: "metrics",
    defaultValue: "e1rm,volume,compliance,prs",
    multi: true,
    options: statsMetricOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    })),
  },
};

export default function StatsFiltersSelectFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");
  const config = useMemo(() => configs[rawField as SelectField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/stats/filters");

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown selection field: ${rawField}`}
          onRetry={() => router.push("/stats/filters")}
          retryLabel="필터로 돌아가기"
        />
      </div>
    );
  }

  if (config.multi) {
    const initial = parseCsvParam(readParamFromHref(returnTo, config.paramKey, config.defaultValue), parseCsvParam(config.defaultValue));
    const [selected, setSelected] = useState<string[]>(initial);

    return (
      <MultiSelectionScreen
        title={config.title}
        sectionTitle={config.sectionTitle}
        sectionFootnote={config.sectionFootnote}
        options={config.options}
        selectedValues={selected}
        onToggle={(next) => {
          setSelected((prev) => {
            const current = new Set(prev);
            if (current.has(next)) current.delete(next);
            else current.add(next);
            return Array.from(current);
          });
        }}
        onApply={() => {
          const normalized = toCsvParam(selected);
          router.push(withPatchedQuery(returnTo, { [config.paramKey]: normalized || config.defaultValue }));
        }}
      />
    );
  }

  const selectedValue = readParamFromHref(returnTo, config.paramKey, config.defaultValue);
  return (
    <SingleSelectionScreen
      title={config.title}
      sectionTitle={config.sectionTitle}
      sectionFootnote={config.sectionFootnote}
      options={config.options}
      selectedValue={selectedValue}
      searchable={config.searchable}
      searchPlaceholder={`${config.title} 검색`}
      onSelect={(next) => {
        router.push(withPatchedQuery(returnTo, { [config.paramKey]: next }));
      }}
    />
  );
}
