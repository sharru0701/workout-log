"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import {
  EmptyStateRows,
  ErrorStateRows,
  NoticeStateRows,
} from "@/components/ui/settings-state";
import { useLocale } from "@/components/locale-provider";
import {
  useWorkoutLogAddExerciseController,
} from "@/features/workout-log/model/use-workout-log-add-exercise-controller";
import { useWorkoutLogContextController } from "@/features/workout-log/model/use-workout-log-context-controller";
import { useWorkoutLogDerivedState } from "@/features/workout-log/model/use-workout-log-derived-state";
import { useWorkoutLogDraftPersistence } from "@/features/workout-log/model/use-workout-log-draft-persistence";
import { useWorkoutLogEditorController } from "@/features/workout-log/model/use-workout-log-editor-controller";
import { useWorkoutLogInlinePickerController } from "@/features/workout-log/model/use-workout-log-inline-picker-controller";
import { useWorkoutLogKeyboardOpenEffect } from "@/features/workout-log/model/use-workout-log-keyboard-open-effect";
import { useWorkoutLogPlanSheetController } from "@/features/workout-log/model/use-workout-log-plan-sheet-controller";
import { readWorkoutLogQueryContext } from "@/features/workout-log/model/query-context";
import { useWorkoutLogSaveController } from "@/features/workout-log/model/use-workout-log-save-controller";
import { applyWorkoutLogWeightRulesToDraft } from "@/features/workout-log/model/weight-rules";
import { WorkoutLogOverlaySheets } from "@/features/workout-log/ui/workout-log-overlay-sheets";
import { WorkoutSessionContent } from "@/features/workout-log/ui/workout-session-content";
import type {
  WorkoutProgramExerciseEntryStateMap,
  WorkoutRecordDraft,
  WorkoutWorkflowState,
} from "@/entities/workout-record";
import type { WorkoutLogPageBootstrap } from "@/server/services/workout-log/get-workout-log-page-bootstrap";
import WorkoutRecordLoading from "@/app/workout/log/loading";

type WorkoutRecordPageProps = WorkoutLogPageBootstrap;

export function WorkoutLogScreen({
  initialPlans,
  initialSettings,
}: WorkoutRecordPageProps) {
  const router = useRouter();
  const { copy, locale } = useLocale();
  const { alert } = useAppDialog();
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [query, setQuery] = useState(() => readWorkoutLogQueryContext());
  const [selectedPlanId, setSelectedPlanId] = useState(() => {
    const initialQuery = readWorkoutLogQueryContext();
    return initialQuery.planId || "";
  });
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
  const [workflowState, setWorkflowState] =
    useState<WorkoutWorkflowState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [programEntryState, setProgramEntryState] =
    useState<WorkoutProgramExerciseEntryStateMap>({});

  const persistenceKey =
    selectedPlanId && query.date ? `${selectedPlanId}:${query.date}` : null;

  const {
    pendingRestorePrompt,
    resolveRestorePrompt,
    isRestoreFlowActive,
    registerReloadDraftContext,
    hasRestoredDraft,
  } = useWorkoutLogDraftPersistence({
    persistenceKey,
    draft,
    programEntryState,
    onRestoreAccepted: useCallback((data) => {
      setDraft(data.draft);
      setProgramEntryState(data.programEntryState);
      setWorkflowState("editing");
    }, []),
  });

  const handleNoPlanDetected = useCallback(async () => {
    await alert({
      title: locale === "ko" ? "프로그램 선택 필요" : "Program Selection Required",
      message:
        locale === "ko"
          ? "선택된 플랜이 없습니다.\n프로그램 스토어로 이동합니다."
          : "No plan is selected.\nYou will be moved to the program store.",
      buttonText: locale === "ko" ? "이동" : "Go",
    });
    router.replace("/program-store");
  }, [alert, locale, router]);

  const openAddSheetFromBootstrap = useCallback(() => {
    setAddSheetOpen(true);
  }, []);

  const {
    plans,
    recentLogItems,
    lastSession,
    loading,
    error,
    workoutPreferences,
    selectedPlan,
    noPlan,
    handlePlanChange,
    retryCurrentContextLoad,
  } = useWorkoutLogContextController({
    initialPlans,
    initialSettings,
    query,
    setQuery,
    selectedPlanId,
    setSelectedPlanId,
    locale,
    browserTimezone,
    applyWeightRulesToDraft: applyWorkoutLogWeightRulesToDraft,
    hasRestoredDraft,
    registerReloadDraftContext,
    setDraft,
    setProgramEntryState,
    setWorkflowState,
    setSaveError,
    onNoPlanDetected: handleNoPlanDetected,
    onBootstrapOpenAddSheet: openAddSheetFromBootstrap,
  });

  const {
    visibleExercises,
    completedExercisesCount,
    sessionExerciseCards,
  } = useWorkoutLogDerivedState({
    draft,
    recentLogItems,
    locale,
    workoutPreferences,
    programEntryState,
  });

  const {
    resolveWeightWithCurrentPreferences,
    handleExerciseAction,
    handleSessionMemoChange,
  } = useWorkoutLogEditorController({
    visibleExercises,
    workoutPreferences,
    setDraft,
    setProgramEntryState,
    setWorkflowState,
  });

  const {
    addDraft,
    setAddDraft,
    exerciseQuery,
    setExerciseQuery,
    exerciseOptionsError,
    setExerciseOptionsError,
    exerciseOptionsLoading,
    filteredExerciseOptions,
    selectedExerciseOption,
    addDraftIncrementKg,
    addDraftIncrementInfo,
    addDraftTotalLoadKg,
    openAddExerciseSheet,
    closeAddExerciseSheet,
    selectExerciseOption,
    handleAddExercise,
  } = useWorkoutLogAddExerciseController({
    open: addSheetOpen,
    setOpen: setAddSheetOpen,
    locale,
    draft,
    recentLogItems,
    workoutPreferences,
    resolveWeightWithCurrentPreferences,
    setDraft,
    setWorkflowState,
  });

  const {
    planSheetOpen,
    planQuery,
    setPlanQuery,
    openPlanSheet,
    closePlanSheet,
    planSheetOptions,
  } = useWorkoutLogPlanSheetController({
    plans,
    selectedPlan,
    selectedPlanId,
    onPlanChange: handlePlanChange,
  });

  const {
    inlinePickerRequest,
    openInlinePicker,
    closeInlinePicker,
    handleInlinePickerChange,
  } = useWorkoutLogInlinePickerController({
    onExerciseAction: handleExerciseAction,
  });

  useWorkoutLogKeyboardOpenEffect();

  const {
    failureProtocolSheet,
    handleFailureProtocolSelect,
    requestSave,
  } = useWorkoutLogSaveController({
    draft,
    visibleExercises,
    programEntryState,
    locale,
    selectedPlan,
    bodyweightKg: workoutPreferences.bodyweightKg,
    persistenceKey,
    setSaveError,
    setWorkflowState,
    onSaved: useCallback(() => {
      router.push("/");
    }, [router]),
  });

  const isEditingExistingLog = Boolean(draft?.session.logId);

  return (
    <>
      {loading && !isRestoreFlowActive && <WorkoutRecordLoading />}
      <ErrorStateRows
        message={error}
        title={
          locale === "ko"
            ? "기록 화면 데이터를 불러오지 못했습니다"
            : "Could not load workout log data"
        }
        onRetry={retryCurrentContextLoad}
      />
      <NoticeStateRows
        message={saveError}
        tone="warning"
        label={copy.workoutLog.validationLabel}
        ariaLabel={copy.workoutLog.validationAriaLabel}
      />
      <EmptyStateRows when={noPlan} label={copy.workoutLog.noPlans} />

      {!noPlan && draft ? (
        <WorkoutSessionContent
          copy={copy.workoutLog}
          locale={locale}
          draft={draft}
          selectedPlanName={selectedPlan?.name ?? draft.session.planName}
          isEditingExistingLog={isEditingExistingLog}
          planSheetOpen={planSheetOpen}
          onOpenPlanSheet={openPlanSheet}
          completedExercisesCount={completedExercisesCount}
          bodyweightKg={workoutPreferences.bodyweightKg}
          lastSession={lastSession}
          exerciseCards={sessionExerciseCards}
          onExerciseAction={handleExerciseAction}
          onOpenInlinePicker={openInlinePicker}
          onOpenAddExerciseSheet={openAddExerciseSheet}
          sessionMemo={draft.session.note.memo}
          onSessionMemoChange={handleSessionMemoChange}
          workflowState={workflowState}
          onSave={requestSave}
        />
      ) : null}

      <WorkoutLogOverlaySheets
        locale={locale}
        copy={copy.workoutLog}
        inlinePickerRequest={inlinePickerRequest}
        onCloseInlinePicker={closeInlinePicker}
        onChangeInlinePicker={handleInlinePickerChange}
        planSheetOpen={planSheetOpen}
        planQuery={planQuery}
        onChangePlanQuery={setPlanQuery}
        onClosePlanSheet={closePlanSheet}
        planSheetOptions={planSheetOptions}
        addSheetOpen={addSheetOpen}
        addDraft={addDraft}
        setAddDraft={setAddDraft}
        exerciseQuery={exerciseQuery}
        setExerciseQuery={setExerciseQuery}
        exerciseOptionsError={exerciseOptionsError}
        setExerciseOptionsError={setExerciseOptionsError}
        exerciseOptionsLoading={exerciseOptionsLoading}
        filteredExerciseOptions={filteredExerciseOptions}
        selectedExerciseOption={selectedExerciseOption}
        onSelectExerciseOption={selectExerciseOption}
        onCloseAddExerciseSheet={closeAddExerciseSheet}
        onAddExercise={handleAddExercise}
        addDraftIncrementKg={addDraftIncrementKg}
        addDraftIncrementInfo={addDraftIncrementInfo}
        addDraftTotalLoadKg={addDraftTotalLoadKg}
        bodyweightKg={workoutPreferences.bodyweightKg}
        resolveWeightWithCurrentPreferences={resolveWeightWithCurrentPreferences}
        pendingRestorePrompt={pendingRestorePrompt}
        onResolveRestorePrompt={resolveRestorePrompt}
        failureProtocolSheet={failureProtocolSheet}
        onSelectFailureProtocol={handleFailureProtocolSelect}
      />
    </>
  );
}
