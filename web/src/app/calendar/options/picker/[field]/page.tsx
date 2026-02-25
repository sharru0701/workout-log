"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorStateRows } from "@/components/ui/settings-state";
import { PickerSelectionScreen } from "@/components/ui/selection-screen-template";
import { normalizeReturnTo, readParamFromHref, withPatchedQuery } from "@/lib/selection-navigation";

type PickerField = "open-time";

type PickerConfig = {
  title: string;
  sectionTitle: string;
  sectionFootnote: string;
  inputLabel: string;
  inputType: "date" | "time" | "number";
  paramKey: string;
  defaultValue: string;
};

const configs: Record<PickerField, PickerConfig> = {
  "open-time": {
    title: "기본 열기 시간",
    sectionTitle: "시간",
    sectionFootnote: "날짜 열기 동작의 기본 시간을 설정합니다.",
    inputLabel: "열기 시간",
    inputType: "time",
    paramKey: "openTime",
    defaultValue: "08:00",
  },
};

export default function CalendarOptionsPickerFieldPage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawField = String(params?.field ?? "");
  const config = useMemo(() => configs[rawField as PickerField], [rawField]);
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"), "/calendar/options");

  if (!config) {
    return (
      <div className="native-page native-page-enter tab-screen momentum-scroll">
        <ErrorStateRows
          message={`Unknown picker field: ${rawField}`}
          onRetry={() => router.push("/calendar/options")}
          retryLabel="옵션으로 돌아가기"
        />
      </div>
    );
  }

  const [value, setValue] = useState(readParamFromHref(returnTo, config.paramKey, config.defaultValue));

  return (
    <PickerSelectionScreen
      title={config.title}
      sectionTitle={config.sectionTitle}
      sectionFootnote={config.sectionFootnote}
      inputLabel={config.inputLabel}
      inputType={config.inputType}
      value={value}
      onValueChange={setValue}
      onApply={() => {
        router.push(withPatchedQuery(returnTo, { [config.paramKey]: value || config.defaultValue }));
      }}
    />
  );
}
