"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent } from "@/components/ui/card";
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
  return (
    <BottomSheet open={open} onClose={onClose} title="운동 추가" description="2탭으로 운동을 넣고 바로 기록하세요.">
      <div className="space-y-3 pb-2">
        <Card padding="md" elevated={false}>
          <CardContent>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">추천/등록 운동 드롭다운 검색/선택</span>
              <div className="workout-combobox" data-no-swipe="true">
                <div className="app-search-shell">
                  <span className="app-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.8-3.8" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    inputMode="search"
                    className="app-search-input"
                    value={addExerciseQuery}
                    placeholder="예: Bench Press"
                    onChange={(event) => onAddExerciseQueryChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (selectedAddExerciseName) {
                        onAddSelectedExercise();
                        return;
                      }
                      onAddExerciseFromQuery();
                    }}
                  />
                  {addExerciseQuery.trim().length > 0 ? (
                    <button type="button" className="app-search-clear" aria-label="검색어 지우기" onClick={onClearAddExerciseQuery}>
                      ×
                    </button>
                  ) : null}
                </div>

                <div className="workout-combobox-panel" role="listbox" aria-label="추천 운동 검색 결과">
                  {addExerciseCandidates.length === 0 ? (
                    <span className="workout-combobox-empty">검색 결과가 없습니다.</span>
                  ) : (
                    addExerciseCandidates.map((exerciseName) => (
                      <button
                        key={exerciseName}
                        type="button"
                        className={`haptic-tap workout-combobox-option${selectedAddExerciseName === exerciseName ? " is-active" : ""}`}
                        onClick={() => onSelectAddExerciseName(exerciseName)}
                      >
                        {exerciseName}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {addExerciseCandidates.length === 0 ? (
          <EmptyStateRows
            when
            label="설정 값 없음"
            description="검색 결과가 없습니다. 이름을 직접 입력해 추가할 수 있습니다."
          />
        ) : (
          <button
            className="haptic-tap workout-action-pill is-secondary w-full text-left"
            type="button"
            disabled={!selectedAddExerciseName}
            onClick={onAddSelectedExercise}
          >
            + 선택한 운동 추가
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
