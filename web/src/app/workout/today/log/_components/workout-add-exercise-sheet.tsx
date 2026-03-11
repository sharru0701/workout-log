"use client";

import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { EmptyStateRows } from "@/components/ui/settings-state";

type WorkoutAddExerciseSheetProps = {
  open: boolean;
  addExerciseQuery: string;
  selectedAddExerciseName: string;
  addExerciseCandidates: string[];
  onClose: () => void;
  onAddExerciseQueryChange: (value: string) => void;
  onSelectAddExerciseName: (value: string) => void;
  onClearAddExerciseQuery: () => void;
  onAddSelectedExercise: () => void;
  onAddExerciseFromQuery: () => void;
};

export default function WorkoutAddExerciseSheet({
  open,
  addExerciseQuery,
  selectedAddExerciseName,
  addExerciseCandidates,
  onClose,
  onAddExerciseQueryChange,
  onSelectAddExerciseName,
  onClearAddExerciseQuery,
  onAddSelectedExercise,
  onAddExerciseFromQuery,
}: WorkoutAddExerciseSheetProps) {
  const canConfirm = Boolean(selectedAddExerciseName || addExerciseQuery.trim());

  const handleConfirm = () => {
    if (selectedAddExerciseName) {
      onAddSelectedExercise();
      return;
    }
    onAddExerciseFromQuery();
  };

  return (
    <SearchSelectSheet
      open={open}
      onClose={onClose}
      title="운동 추가"
      description="2탭으로 운동을 넣고 바로 기록하세요."
      primaryAction={{
        ariaLabel: "기록 영역에 추가",
        onPress: handleConfirm,
        disabled: !canConfirm,
      }}
      label="추천/등록 운동 드롭다운 검색/선택"
      query={addExerciseQuery}
      placeholder="예: Bench Press"
      onQueryChange={onAddExerciseQueryChange}
      onQuerySubmit={() => {
        if (selectedAddExerciseName) {
          onAddSelectedExercise();
          return;
        }
        onAddExerciseFromQuery();
      }}
      onClearQuery={onClearAddExerciseQuery}
      resultsAriaLabel="추천 운동 검색 결과"
      emptyText="검색 결과가 없습니다."
      options={addExerciseCandidates.map((exerciseName) => ({
        key: exerciseName,
        label: exerciseName,
        active: selectedAddExerciseName === exerciseName,
        onSelect: () => onSelectAddExerciseName(exerciseName),
      }))}
    >
      {addExerciseCandidates.length === 0 ? (
        <EmptyStateRows
          when
          label="설정 값 없음"
          description="검색 결과가 없습니다. 이름을 직접 입력한 뒤 체크 버튼으로 추가할 수 있습니다."
        />
      ) : null}
    </SearchSelectSheet>
  );
}
