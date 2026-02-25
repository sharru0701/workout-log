"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import { SingleSelectionScreen, type SelectionOption } from "@/components/ui/selection-screen-template";
import { commonTimezoneOptions } from "@/lib/selection-options";
import { normalizeReturnTo, readParamFromHref, withPatchedQuery } from "@/lib/selection-navigation";

type SelectField = "view-mode" | "auto-open" | "timezone";

type FieldConfig = {
  title: string;
  sectionTitle: string;
  sectionFootnote: string;
  paramKey: string;
  defaultValue: string;
  searchable?: boolean;
  options: SelectionOption[];
};

const configs: Record<SelectField, FieldConfig> = {
  "view-mode": {
    title: "보기 방식",
    sectionTitle: "표시",
    sectionFootnote: "하나를 선택하면 바로 적용됩니다.",
    paramKey: "viewMode",
    defaultValue: "month",
    options: [
      { value: "month", label: "month", description: "월간 6주 그리드로 표시합니다." },
      { value: "week", label: "week", description: "1주 집중 그리드로 표시합니다." },
    ],
  },
  "auto-open": {
    title: "열기 동작",
    sectionTitle: "열기 방식",
    sectionFootnote: "수동 확인이 필요하면 OPEN_ONLY를 권장합니다.",
    paramKey: "autoOpen",
    defaultValue: "OPEN_ONLY",
    options: [
      { value: "OPEN_ONLY", label: "날짜만 열기", description: "즉시 생성 없이 컨텍스트만 엽니다." },
      { value: "AUTO_GENERATE", label: "열고 바로 생성", description: "날짜를 열 때 세션을 함께 생성합니다." },
    ],
  },
  timezone: {
    title: "시간대",
    sectionTitle: "시간대 목록",
    sectionFootnote: "검색한 뒤 한 번 탭해 적용합니다.",
    paramKey: "timezone",
    defaultValue: "UTC",
    searchable: true,
    options: commonTimezoneOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
      keywords: option.keywords,
    })),
  },
};

export default function CalendarOptionsSelectFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");
  const config = useMemo(() => configs[rawField as SelectField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/calendar/options");

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown selection field: ${rawField}`}
          onRetry={() => router.push("/calendar/options")}
          retryLabel="옵션으로 돌아가기"
        />
      </div>
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
