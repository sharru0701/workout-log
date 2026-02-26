"use client";

import { useMemo, useState } from "react";
import { MultiSelectionScreen, PickerSelectionScreen, SingleSelectionScreen } from "@/components/ui/selection-screen-template";
import { commonExerciseOptions, statsMetricOptions } from "@/lib/selection-options";

export default function SelectionTemplatePage() {
  const [singleValue, setSingleValue] = useState("DATE");
  const [multiValues, setMultiValues] = useState<string[]>(["e1rm", "volume"]);
  const [searchValue, setSearchValue] = useState("Back Squat");
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [timeValue, setTimeValue] = useState("08:00");
  const [numberValue, setNumberValue] = useState("90");

  const metricOptionValues = useMemo(() => new Set(statsMetricOptions.map((option) => option.value)), []);

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <SingleSelectionScreen
        title="선택 템플릿"
        sectionTitle="세션 키 방식"
        sectionFootnote="하나를 선택하면 현재 값이 즉시 반영됩니다."
        selectedValue={singleValue}
        options={[
          { value: "DATE", label: "DATE", description: "YYYY-MM-DD 키를 사용합니다." },
          { value: "LEGACY", label: "LEGACY", description: "WnDn 키를 사용합니다." },
        ]}
        onSelect={setSingleValue}
      />

      <MultiSelectionScreen
        title="선택 템플릿"
        sectionTitle="지표 섹션"
        sectionFootnote="여러 항목을 선택한 뒤 적용하세요."
        selectedValues={multiValues}
        options={statsMetricOptions.map((option) => ({
          value: option.value,
          label: option.label,
          description: option.description,
        }))}
        onToggle={(next) => {
          setMultiValues((prev) => {
            const current = new Set(prev);
            if (current.has(next)) current.delete(next);
            else current.add(next);
            const filtered = Array.from(current).filter((value) => metricOptionValues.has(value));
            return filtered;
          });
        }}
        onApply={() => undefined}
      />

      <SingleSelectionScreen
        title="선택 템플릿"
        sectionTitle="운동"
        sectionFootnote="검색 후 원하는 운동을 선택하세요."
        searchable
        selectedValue={searchValue}
        options={commonExerciseOptions.map((option) => ({
          value: option.value,
          label: option.label,
          keywords: option.keywords,
        }))}
        onSelect={setSearchValue}
      />

      <PickerSelectionScreen
        title="선택 템플릿"
        sectionTitle="날짜"
        sectionFootnote="시스템 날짜 입력을 사용합니다."
        inputLabel="날짜"
        inputType="date"
        value={dateValue}
        onValueChange={setDateValue}
        onApply={() => undefined}
      />

      <PickerSelectionScreen
        title="선택 템플릿"
        sectionTitle="시간"
        sectionFootnote="시스템 시간 입력을 사용합니다."
        inputLabel="시간"
        inputType="time"
        value={timeValue}
        onValueChange={setTimeValue}
        onApply={() => undefined}
      />

      <PickerSelectionScreen
        title="선택 템플릿"
        sectionTitle="숫자"
        sectionFootnote="정수 범위를 지정해 입력합니다."
        inputLabel="일수"
        inputType="number"
        min={1}
        max={365}
        step={1}
        value={numberValue}
        onValueChange={setNumberValue}
        onApply={() => undefined}
      />
    </div>
  );
}
