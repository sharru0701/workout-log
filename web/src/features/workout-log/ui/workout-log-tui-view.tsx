"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { useLocale } from "@/components/locale-provider";
import { SetRowFocusChainProvider } from "@/features/workout-log/model/use-set-row-focus-chain";
import { visibleExercisesAtom } from "@/features/workout-log/store/workout-log-atoms";
import type { ExerciseRowAction } from "@/features/workout-log/model/editor-actions";
import { TermTable } from "@/features/workout-log/ui/term-table";

// terminal(ironlog) 운동 로그 본문 뷰 — paper WorkoutLogStackedList의 terminal
// 대응(Step 1c, "테이블만"). 동일 SetRowFocusChainProvider 안에서 TermTable을
// mount해 focus chain을 공유한다(R-3). 헤더·DateNav·진행바·로그·mode·저장(⏎)은
// 후속 단계(Step 2~6). 이 뷰는 TermShell ViewPane 안에서 렌더되므로 외곽 패딩은 두지 않는다.
type Props = {
  onExerciseAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenAddExerciseSheet?: () => void;
};

export function WorkoutLogTuiView({
  onExerciseAction,
  onOpenAddExerciseSheet,
}: Props) {
  return (
    <SetRowFocusChainProvider>
      <TuiViewContent
        onExerciseAction={onExerciseAction}
        onOpenAddExerciseSheet={onOpenAddExerciseSheet}
      />
    </SetRowFocusChainProvider>
  );
}

function TuiViewContent({ onExerciseAction, onOpenAddExerciseSheet }: Props) {
  const { locale } = useLocale();
  const visibleExercises = useAtomValue(visibleExercisesAtom);
  const exercises = useMemo(
    () => visibleExercises.filter((ex) => !ex.deleted),
    [visibleExercises],
  );

  return (
    <section
      aria-label={locale === "ko" ? "운동 목록" : "Exercise list"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--v2-s-3)",
      }}
    >
      {exercises.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--v2-s-3)",
            padding: "var(--v2-s-7) var(--v2-s-4)",
            textAlign: "center",
          }}
        >
          <p className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {locale === "ko" ? "기록할 운동이 없습니다." : "No exercises to log."}
          </p>
          {onOpenAddExerciseSheet ? (
            <AddExerciseAction onClick={onOpenAddExerciseSheet} locale={locale} />
          ) : null}
        </div>
      ) : (
        <>
          {exercises.map((ex) => (
            <TermTable
              key={ex.id}
              exerciseId={ex.id}
              onExerciseAction={onExerciseAction}
            />
          ))}
          {onOpenAddExerciseSheet ? (
            <AddExerciseAction onClick={onOpenAddExerciseSheet} locale={locale} />
          ) : null}
        </>
      )}
    </section>
  );
}

// 운동 추가 = 전폭 keyhint 버튼(box 프레임=boxShadow inset, border 금지, radius0).
function AddExerciseAction({
  onClick,
  locale,
}: {
  onClick: () => void;
  locale: "ko" | "en";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-mono-label"
      style={{
        width: "100%",
        minHeight: "var(--v2-touch)",
        padding: "var(--v2-s-2) var(--v2-s-3)",
        background: "transparent",
        border: "none",
        boxShadow: "inset 0 0 0 1px var(--term-line-box)",
        color: "var(--term-cyan)",
        cursor: "pointer",
      }}
    >
      [+ {locale === "ko" ? "운동 추가" : "add exercise"}]
    </button>
  );
}
