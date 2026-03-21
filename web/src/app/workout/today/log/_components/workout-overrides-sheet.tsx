"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";

type WorkoutSetOption = {
  exerciseName: string;
  isExtra: boolean;
  isPlanned: boolean;
};

type WorkoutOverridesSheetProps = {
  open: boolean;
  sessionKeyLabel: string;
  selectedSetIdx: number | null;
  sets: WorkoutSetOption[];
  blockTarget: string;
  replacementExerciseName: string;
  onClose: () => void;
  onSelectSetIdx: (value: number | null) => void;
  onMakeAccessoryPermanent: () => void;
  onBlockTargetChange: (value: string) => void;
  onReplacementExerciseNameChange: (value: string) => void;
  onReplaceExercisePermanent: () => void;
};

export default function WorkoutOverridesSheet({
  open,
  sessionKeyLabel,
  selectedSetIdx,
  sets,
  blockTarget,
  replacementExerciseName,
  onClose,
  onSelectSetIdx,
  onMakeAccessoryPermanent,
  onBlockTargetChange,
  onReplacementExerciseNameChange,
  onReplaceExercisePermanent,
}: WorkoutOverridesSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="세션 오버라이드" description={`대상 세션: ${sessionKeyLabel}`}>
      <div>
        <Card padding="md" elevated={false}>
          <CardContent>
            <AppSelect
              label="선택 세트 행(추가 상태 필수)"
              wrapperClassName="md:col-span-2"
              value={selectedSetIdx === null ? "" : String(selectedSetIdx)}
              onChange={(event) => {
                onSelectSetIdx(event.target.value === "" ? null : Number(event.target.value));
              }}
            >
              <option value="">(행 선택)</option>
              {sets.map((set, idx) => (
                <option key={idx} value={idx}>
                  #{idx + 1} {set.exerciseName || "(비어 있음)"} [{set.isExtra ? "추가" : set.isPlanned ? "계획" : "사용자"}]
                </option>
              ))}
            </AppSelect>
            <button
              type="button"
              onClick={onMakeAccessoryPermanent}
            >
              보조 운동 고정
            </button>
          </CardContent>
        </Card>

        <Card padding="md" elevated={false}>
          <CardContent>
            <AppSelect label="블록 대상" value={blockTarget} onChange={(event) => onBlockTargetChange(event.target.value)}>
              <option value="SQUAT">SQUAT</option>
              <option value="BENCH">BENCH</option>
              <option value="DEADLIFT">DEADLIFT</option>
              <option value="OHP">OHP</option>
              <option value="PULL">PULL</option>
              <option value="CUSTOM">CUSTOM</option>
            </AppSelect>
            <label>
              <span>대체 운동 이름</span>
              <AppTextInput
                variant="compact"
                value={replacementExerciseName}
                onChange={(event) => onReplacementExerciseNameChange(event.target.value)}
                placeholder="예: Paused Bench Press"
              />
            </label>
            <button
              type="button"
              onClick={onReplaceExercisePermanent}
            >
              운동 교체
            </button>
          </CardContent>
        </Card>
      </div>
    </BottomSheet>
  );
}
