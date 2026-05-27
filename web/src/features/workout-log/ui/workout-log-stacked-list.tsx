"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { useLocale } from "@/components/locale-provider";
import {
  SetRowFocusChainProvider,
  type SetRowFocusChainApi,
} from "@/features/workout-log/model/use-set-row-focus-chain";
import { visibleExercisesAtom } from "@/features/workout-log/store/workout-log-atoms";
import type { ExerciseRowAction } from "@/features/workout-log/model/editor-actions";
import { WorkoutExerciseCard } from "@/features/workout-log/ui/workout-exercise-card";

export type WorkoutLogStackedListHandle = {
  focusFirstEmptyOf: (exerciseId: string) => void;
};

type Props = {
  onExerciseAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenAddExerciseSheet?: () => void;
};

export const WorkoutLogStackedList = forwardRef<
  WorkoutLogStackedListHandle,
  Props
>(function WorkoutLogStackedList(
  { onExerciseAction, onOpenAddExerciseSheet },
  ref,
) {
  const apiRef = useRef<SetRowFocusChainApi | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusFirstEmptyOf(exerciseId) {
        apiRef.current?.focusFirstEmptyOf(exerciseId);
      },
    }),
    [],
  );

  return (
    <SetRowFocusChainProvider apiRef={apiRef}>
      <StackedListContent
        onExerciseAction={onExerciseAction}
        onOpenAddExerciseSheet={onOpenAddExerciseSheet}
      />
    </SetRowFocusChainProvider>
  );
});

function StackedListContent({
  onExerciseAction,
  onOpenAddExerciseSheet,
}: Props) {
  const { locale } = useLocale();
  const visibleExercises = useAtomValue(visibleExercisesAtom);
  const allExercises = useMemo(
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
      {allExercises.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--v2-s-3)",
            padding: "var(--v2-s-7) var(--v2-s-4)",
            textAlign: "center",
          }}
        >
          <p className="v2-small" style={{ color: "var(--v2-ink-3)" }}>
            {locale === "ko"
              ? "기록할 운동이 없습니다."
              : "No exercises to log."}
          </p>
          {onOpenAddExerciseSheet && (
            <AddExerciseButton
              onClick={onOpenAddExerciseSheet}
              locale={locale}
            />
          )}
        </div>
      ) : (
        <>
          {allExercises.map((ex) => (
            <WorkoutExerciseCard
              key={ex.id}
              exerciseId={ex.id}
              onExerciseAction={onExerciseAction}
            />
          ))}
          {onOpenAddExerciseSheet && (
            <AddExerciseButton
              onClick={onOpenAddExerciseSheet}
              locale={locale}
            />
          )}
        </>
      )}
    </section>
  );
}

function AddExerciseButton({
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
      className="v2-font-display"
      style={{
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--v2-s-2)",
        padding: "var(--v2-s-4)",
        borderRadius: "var(--v2-r-3)",
        background: "var(--v2-paper-2)",
        color: "var(--v2-accent)",
        border: "none",
        cursor: "pointer",
        minHeight: "var(--v2-s-8)",
        fontWeight: 700,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "var(--v2-t-h2)" }}
        aria-hidden
      >
        add
      </span>
      <span className="v2-mono-label">
        {locale === "ko" ? "운동 추가" : "Add exercise"}
      </span>
    </button>
  );
}
