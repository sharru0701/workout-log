"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import { SingleSelectionScreen, type SelectionOption } from "@/components/ui/selection-screen-template";
import { commonTimezoneOptions } from "@/lib/selection-options";
import { normalizeReturnTo, readParamFromHref, withPatchedQuery } from "@/lib/selection-navigation";

type SelectField = "user-id" | "session-key-mode" | "timezone";

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
  "user-id": {
    title: "사용자 ID",
    sectionTitle: "사용 범위",
    sectionFootnote: "하나를 선택하면 바로 적용됩니다.",
    paramKey: "userId",
    defaultValue: "dev",
    options: [
      { value: "dev", label: "dev", description: "기본 개발 작업 공간" },
      { value: "coach", label: "coach", description: "코치 관리 계정 범위" },
      { value: "athlete", label: "athlete", description: "선수 단일 계정 범위" },
    ],
  },
  "session-key-mode": {
    title: "세션 키 방식",
    sectionTitle: "방식",
    sectionFootnote: "캘린더 기준 사용 시 DATE를 권장합니다.",
    paramKey: "sessionKeyMode",
    defaultValue: "DATE",
    options: [
      { value: "DATE", label: "DATE", description: "YYYY-MM-DD 키를 사용합니다." },
      { value: "LEGACY", label: "LEGACY", description: "주/일 기반 WnDn 키를 사용합니다." },
    ],
  },
  timezone: {
    title: "시간대",
    sectionTitle: "시간대 목록",
    sectionFootnote: "도시 이름으로 검색한 뒤 한 번 탭해 적용합니다.",
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

export default function PlansContextSelectFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");

  const config = useMemo(() => configs[rawField as SelectField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/plans/context");

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown selection field: ${rawField}`}
          onRetry={() => router.push("/plans/context")}
          retryLabel="컨텍스트로 돌아가기"
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
