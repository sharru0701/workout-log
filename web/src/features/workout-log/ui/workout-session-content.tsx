"use client";

import { memo } from "react";
import { PlanSelectorButton } from "@/components/ui/plan-selector-button";
import { AppTextarea } from "@/components/ui/form-controls";
import { PrimaryButton } from "@/components/ui/primary-button";
import type {
  ExerciseRowAction,
  InlinePickerRequest,
} from "@/features/workout-log/model/editor-actions";
import { formatDateFriendly } from "@/features/workout-log/model/last-session-summary";
import type { WorkoutLogLastSessionSummary } from "@/features/workout-log/model/types";
import { ExerciseRow } from "@/features/workout-log/ui/exercise-row";
import {
  areWorkoutExercisesEqual,
  areWorkoutLogLastSessionSummariesEqual,
  areWorkoutProgramEntryStatesEqual,
} from "@/features/workout-log/ui/prop-equality";
import type { AppCopy, AppLocale } from "@/lib/i18n/messages";
import type {
  WorkoutExerciseViewModel,
  WorkoutProgramExerciseEntryState,
  WorkoutRecordDraft,
  WorkoutWorkflowState,
} from "@/entities/workout-record";

export type WorkoutSessionExerciseCard = {
  id: string;
  exercise: WorkoutExerciseViewModel;
  minimumPlateIncrementKg: number;
  showMinimumPlateInfo: boolean;
  prevPerformance?: string;
  programEntryState?: WorkoutProgramExerciseEntryState;
};

type WorkoutSessionContentProps = {
  copy: AppCopy["workoutLog"];
  locale: AppLocale;
  draft: WorkoutRecordDraft;
  selectedPlanName: string;
  isEditingExistingLog: boolean;
  planSheetOpen: boolean;
  onOpenPlanSheet: () => void;
  completedExercisesCount: number;
  bodyweightKg: number | null;
  lastSession: WorkoutLogLastSessionSummary | null;
  exerciseCards: WorkoutSessionExerciseCard[];
  onExerciseAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenInlinePicker: (request: InlinePickerRequest) => void;
  onOpenAddExerciseSheet: () => void;
  sessionMemo: string;
  onSessionMemoChange: (value: string) => void;
  workflowState: WorkoutWorkflowState;
  onSave: () => void;
};

type WorkoutExerciseCardsListProps = {
  locale: AppLocale;
  bodyweightKg: number | null;
  exerciseCards: WorkoutSessionExerciseCard[];
  onExerciseAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenInlinePicker: (request: InlinePickerRequest) => void;
};

function areExerciseCardsEqual(
  left: WorkoutSessionExerciseCard[],
  right: WorkoutSessionExerciseCard[],
) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const previous = left[index];
    const next = right[index];
    if (
      previous.id !== next.id ||
      previous.minimumPlateIncrementKg !== next.minimumPlateIncrementKg ||
      previous.showMinimumPlateInfo !== next.showMinimumPlateInfo ||
      previous.prevPerformance !== next.prevPerformance ||
      !areWorkoutExercisesEqual(previous.exercise, next.exercise) ||
      !areWorkoutProgramEntryStatesEqual(
        previous.programEntryState,
        next.programEntryState,
      )
    ) {
      return false;
    }
  }
  return true;
}

function areWorkoutExerciseCardsListPropsEqual(
  previous: WorkoutExerciseCardsListProps,
  next: WorkoutExerciseCardsListProps,
) {
  return (
    previous.locale === next.locale &&
    previous.bodyweightKg === next.bodyweightKg &&
    previous.onExerciseAction === next.onExerciseAction &&
    previous.onOpenInlinePicker === next.onOpenInlinePicker &&
    areExerciseCardsEqual(previous.exerciseCards, next.exerciseCards)
  );
}

function areWorkoutSessionContentPropsEqual(
  previous: WorkoutSessionContentProps,
  next: WorkoutSessionContentProps,
) {
  return (
    previous.copy === next.copy &&
    previous.locale === next.locale &&
    previous.selectedPlanName === next.selectedPlanName &&
    previous.isEditingExistingLog === next.isEditingExistingLog &&
    previous.planSheetOpen === next.planSheetOpen &&
    previous.onOpenPlanSheet === next.onOpenPlanSheet &&
    previous.completedExercisesCount === next.completedExercisesCount &&
    previous.bodyweightKg === next.bodyweightKg &&
    previous.onExerciseAction === next.onExerciseAction &&
    previous.onOpenInlinePicker === next.onOpenInlinePicker &&
    previous.onOpenAddExerciseSheet === next.onOpenAddExerciseSheet &&
    previous.sessionMemo === next.sessionMemo &&
    previous.onSessionMemoChange === next.onSessionMemoChange &&
    previous.workflowState === next.workflowState &&
    previous.onSave === next.onSave &&
    previous.draft.session.week === next.draft.session.week &&
    previous.draft.session.sessionType === next.draft.session.sessionType &&
    previous.draft.session.sessionDate === next.draft.session.sessionDate &&
    areWorkoutLogLastSessionSummariesEqual(previous.lastSession, next.lastSession) &&
    areExerciseCardsEqual(previous.exerciseCards, next.exerciseCards)
  );
}

const WorkoutExerciseCardsList = memo(function WorkoutExerciseCardsList({
  locale,
  bodyweightKg,
  exerciseCards,
  onExerciseAction,
  onOpenInlinePicker,
}: WorkoutExerciseCardsListProps) {
  if (exerciseCards.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-md) 0",
          color: "var(--text-hint)",
          fontSize: "14px",
        }}
      >
        {locale === "ko" ? "기록할 운동이 없습니다." : "No exercises to log."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {exerciseCards.map((item) => (
        <div key={item.id}>
          <ExerciseRow
            exerciseId={item.id}
            exercise={item.exercise}
            minimumPlateIncrementKg={item.minimumPlateIncrementKg}
            showMinimumPlateInfo={item.showMinimumPlateInfo}
            bodyweightKg={bodyweightKg}
            prevPerformance={item.prevPerformance}
            programEntryState={item.programEntryState}
            onAction={onExerciseAction}
            onOpenInlinePicker={onOpenInlinePicker}
          />
        </div>
      ))}
    </div>
  );
}, areWorkoutExerciseCardsListPropsEqual);

export const WorkoutSessionContent = memo(function WorkoutSessionContent({
  copy,
  locale,
  draft,
  selectedPlanName,
  isEditingExistingLog,
  planSheetOpen,
  onOpenPlanSheet,
  completedExercisesCount,
  bodyweightKg,
  lastSession,
  exerciseCards,
  onExerciseAction,
  onOpenInlinePicker,
  onOpenAddExerciseSheet,
  sessionMemo,
  onSessionMemoChange,
  workflowState,
  onSave,
}: WorkoutSessionContentProps) {
  return (
    <>
      <section className="plan-selector-strip">
        <div className="plan-selector-strip__label">{copy.activePlanLabel}</div>
        <PlanSelectorButton
          planName={selectedPlanName}
          aria-expanded={isEditingExistingLog ? false : planSheetOpen}
          onClick={isEditingExistingLog ? undefined : onOpenPlanSheet}
          disabled={isEditingExistingLog}
        />
        {isEditingExistingLog ? (
          <p style={{ marginTop: "var(--space-xs)", fontSize: "12px", color: "var(--text-hint)" }}>
            {copy.planLockedWhileEditing}
          </p>
        ) : null}
      </section>

      <section>
        <div className="session-progress-header">
          <div className="session-progress-header__top-row">
            <div className="session-progress-header__title-group">
              <div className="session-progress-header__eyebrow">
                {isEditingExistingLog ? copy.editingLog : copy.activeSession}
              </div>
              <h2 className="session-progress-header__title">
                Week {draft.session.week} · {draft.session.sessionType}
              </h2>
            </div>
          </div>
          <div className="session-progress-header__chips">
            <span className={`session-chip ${completedExercisesCount > 0 ? "session-chip--active" : ""}`}>
              {completedExercisesCount}/{exerciseCards.length} {copy.exercisesCount}
            </span>
            <span className="session-chip session-chip--date">
              {formatDateFriendly(draft.session.sessionDate, locale)}
            </span>
            {bodyweightKg ? (
              <span className="session-chip">
                {copy.bodyweightShort} {bodyweightKg.toFixed(1)}kg
              </span>
            ) : null}
          </div>
        </div>

        {lastSession ? (
          <div className="last-session-banner">
            <div className="last-session-banner__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>
                history
              </span>
            </div>
            <div className="last-session-banner__body">
              <div className="last-session-banner__label">{copy.lastSession}</div>
              <div className="last-session-banner__title">
                {lastSession.weekLabel} · {lastSession.sessionLabel}
              </div>
              <div className="last-session-banner__meta">{lastSession.dateLabel}</div>
            </div>
            {lastSession.totalSets != null ? (
              <div className="last-session-banner__stat">
                <div className="last-session-banner__stat-value">{lastSession.totalSets}</div>
                <div className="last-session-banner__stat-label">{copy.sets}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <WorkoutExerciseCardsList
            locale={locale}
            bodyweightKg={bodyweightKg}
            exerciseCards={exerciseCards}
            onExerciseAction={onExerciseAction}
            onOpenInlinePicker={onOpenInlinePicker}
          />
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <button
            type="button"
            className="btn-add-exercise"
            onClick={onOpenAddExerciseSheet}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 28, fontVariationSettings: "'wght' 300" }}>
              add
            </span>
            <span>{copy.addExerciseButton}</span>
          </button>
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <div
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              marginBottom: "6px",
            }}
          >
            {locale === "ko" ? "세션 메모" : "Session Memo"}
          </div>
          <label>
            <AppTextarea
              variant="workout"
              value={sessionMemo}
              onChange={(event) => {
                onSessionMemoChange(event.target.value);
              }}
              placeholder={copy.sessionMemoPlaceholder}
              style={{
                border: "none",
                borderRadius: "16px",
                background: "var(--color-surface-container-low)",
              }}
            />
          </label>
        </div>

        <div className="finish-workout-cta">
          <PrimaryButton
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSave}
            disabled={workflowState === "saving"}
          >
            {workflowState === "saving"
              ? copy.saveInProgress
              : isEditingExistingLog
                ? copy.saveEdited
                : copy.saveCreate}
          </PrimaryButton>
        </div>
      </section>
    </>
  );
}, areWorkoutSessionContentPropsEqual);
