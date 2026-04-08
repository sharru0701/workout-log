"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { useWorkoutLogState } from "../model/use-workout-log-state";
import { WorkoutLogHeader, LastSessionBanner, type LastSessionSummary } from "./workout-log-header";
import { WorkoutLogPlanSelector } from "./workout-log-plan-selector";
import { ExerciseRow } from "./exercise-row";
import { AddExerciseSheet, type AddExerciseDraft, type ExerciseOption } from "./add-exercise-sheet";
import { saveWorkoutLogAction, generateWorkoutSessionAction } from "../api/actions";
import { 
  WorkoutRecordDraft, 
  WorkoutProgramExerciseEntryStateMap,
  materializeWorkoutExercises,
  validateWorkoutRecordEntryState,
  validateWorkoutDraft,
  toWorkoutLogPayload,
  addUserExercise,
  resolveWeightWithPreferences,
  createWorkoutRecordDraft,
  prepareWorkoutRecordDraftForEntry,
} from "@/entities/workout";
import { WorkoutPreferences, resolveMinimumPlateIncrementKg, resolveMinimumPlateIncrement } from "@/lib/settings/workout-preferences";
import { PrimaryButton } from "@/shared/ui/primary-button";
import { AppTextarea } from "@/shared/ui/form-controls";
import { NumberPickerSheet } from "@/shared/ui/number-picker-sheet";
import { SearchSelectSheet } from "@/shared/ui/search-select-sheet";
import { NoticeStateRows } from "@/shared/ui/settings-state";
import { InlinePickerRequest } from "./inline-picker";
import { isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { useWorkoutRecordPersistence } from "@/lib/workout-record/useWorkoutRecordPersistence";
import { clearWorkoutDraft } from "@/lib/storage/workoutDraftStore";

export function WorkoutLogBoard({
  initialDraft,
  initialEntryState,
  plans,
  recentLogItems: initialRecentLogs,
  exerciseOptions: initialExerciseOptions,
  preferences,
  lastSession: initialLastSession,
  persistenceKey,
}: {
  initialDraft: WorkoutRecordDraft;
  initialEntryState: WorkoutProgramExerciseEntryStateMap;
  plans: any[];
  recentLogItems: any[];
  exerciseOptions: ExerciseOption[];
  preferences: WorkoutPreferences;
  lastSession: LastSessionSummary | null;
  persistenceKey: string | null;
}) {
  const router = useRouter();
  const { copy, locale } = useLocale();
  const {
    draft,
    setDraft,
    programEntryState,
    setProgramEntryState,
    workflowState,
    setWorkflowState,
    updateExerciseAction,
  } = useWorkoutLogState(initialDraft, initialEntryState);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [inlinePickerRequest, setInlinePickerRequest] = useState<InlinePickerRequest | null>(null);
  const recentLogItems = initialRecentLogs;
  const lastSession = initialLastSession;
  const exerciseOptions = initialExerciseOptions;

  // Persistence
  useWorkoutRecordPersistence(
    persistenceKey,
    draft,
    programEntryState,
    useCallback((restored) => {
      setDraft(restored.draft);
      setProgramEntryState(restored.programEntryState);
      return true;
    }, [setDraft, setProgramEntryState]),
  );

  const visibleExercises = useMemo(() => materializeWorkoutExercises(draft), [draft]);
  const completedExercisesCount = visibleExercises.filter(e => 
    e.set.repsPerSet.every(reps => reps > 0)
  ).length;

  const handleSave = async () => {
    const entryErrors = validateWorkoutRecordEntryState(visibleExercises, programEntryState, locale);
    if (entryErrors.length > 0) {
      setSaveError(entryErrors[0]);
      return;
    }

    const validation = validateWorkoutDraft(draft, locale);
    if (!validation.valid) {
      setSaveError(validation.errors[0]);
      return;
    }

    try {
      setWorkflowState("saving");
      setSaveError(null);
      const payload = toWorkoutLogPayload(draft, {
        bodyweightKg: preferences.bodyweightKg,
        isBodyweightExercise: isBodyweightExerciseName,
      });

      const res = await saveWorkoutLogAction(payload);
      if (res.success) {
        if (persistenceKey) {
          await clearWorkoutDraft(persistenceKey);
        }
        setWorkflowState("done");
        router.push("/");
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      setSaveError(e.message || "Failed to save");
      setWorkflowState("editing");
    }
  };

  const handleAddExercise = (addDraft: AddExerciseDraft) => {
    setDraft(prev => addUserExercise(prev, {
      exerciseId: addDraft.exerciseId,
      exerciseName: addDraft.exerciseName,
      weightKg: addDraft.weightKg,
      repsPerSet: addDraft.repsPerSet,
      memo: addDraft.memo,
    }));
  };

  const openInlinePicker = useCallback((req: InlinePickerRequest) => {
    setInlinePickerRequest(req);
  }, []);

  const closeInlinePicker = () => setInlinePickerRequest(null);

  const handleInlinePickerChange = (value: number) => {
    if (inlinePickerRequest?.onChange) {
      inlinePickerRequest.onChange(value);
    }
    closeInlinePicker();
  };

  const handlePlanSelect = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    setPlanSheetOpen(false);
    setWorkflowState("editing");
    
    try {
      const res = await generateWorkoutSessionAction({
        planId: plan.id,
      });
      if (res.success && res.session) {
        const prepared = prepareWorkoutRecordDraftForEntry(
          createWorkoutRecordDraft(res.session, plan.name, {
            locale,
          })
        );
        setDraft(prepared.draft);
        setProgramEntryState(prepared.programEntryState);
      }
    } catch (e) {
      console.error("Failed to change plan", e);
    }
  };

  return (
    <>
      <NoticeStateRows message={saveError} tone="warning" />

      <WorkoutLogPlanSelector 
        planName={draft.session.planName}
        isLocked={Boolean(draft.session.logId)}
        isOpen={planSheetOpen}
        onClick={() => setPlanSheetOpen(true)}
      />

      <section>
        <WorkoutLogHeader 
          week={draft.session.week}
          sessionType={draft.session.sessionType}
          completedCount={completedExercisesCount}
          totalCount={visibleExercises.length}
          sessionDate={draft.session.sessionDate}
          bodyweightKg={preferences.bodyweightKg}
          isEditing={Boolean(draft.session.logId)}
        />

        <LastSessionBanner lastSession={lastSession} />

        <div className="exercise-list">
          {visibleExercises.map(exercise => (
            <ExerciseRow 
              key={exercise.id}
              exerciseId={exercise.id}
              exercise={exercise}
              minimumPlateIncrementKg={resolveMinimumPlateIncrementKg(preferences, {
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
              })}
              showMinimumPlateInfo={
                resolveMinimumPlateIncrement(preferences, {
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                }).source === "RULE"
              }
              bodyweightKg={preferences.bodyweightKg}
              programEntryState={programEntryState[exercise.id]}
              onAction={(id, action) => updateExerciseAction(exercise, action, preferences)}
              onOpenInlinePicker={openInlinePicker}
            />
          ))}
        </div>

        <button className="btn-add-exercise" onClick={() => setAddSheetOpen(true)}>
          {copy.workoutLog.addExerciseButton}
        </button>

        <div className="session-memo">
           <AppTextarea 
             value={draft.session.note.memo} 
             onChange={e => setDraft(p => ({ ...p, session: { ...p.session, note: { memo: e.target.value } } }))}
             placeholder={copy.workoutLog.sessionMemoPlaceholder}
           />
        </div>

        <div className="finish-workout-cta">
          <PrimaryButton
            onClick={handleSave}
            disabled={workflowState === "saving"}
          >
            {workflowState === "saving" ? copy.workoutLog.saveInProgress : copy.workoutLog.saveCreate}
          </PrimaryButton>
        </div>
      </section>

      <AddExerciseSheet 
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={handleAddExercise}
        exerciseOptions={exerciseOptions}
        preferences={preferences}
        recentLogItems={recentLogItems}
        resolveWeightWithPreferences={(w, id, n) => resolveWeightWithPreferences(w, id, n, preferences)}
      />

      <NumberPickerSheet 
        open={inlinePickerRequest !== null}
        onClose={closeInlinePicker}
        title={inlinePickerRequest?.title ?? "Value"}
        value={inlinePickerRequest?.value ?? 0}
        min={inlinePickerRequest?.min ?? 0}
        max={inlinePickerRequest?.max ?? 100}
        step={inlinePickerRequest?.step ?? 1}
        onChange={handleInlinePickerChange}
        formatValue={inlinePickerRequest?.formatValue}
      />

      <SearchSelectSheet 
        open={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        title={copy.workoutLog.planSheetTitle}
        query={planQuery}
        onQueryChange={setPlanQuery}
        placeholder={copy.workoutLog.planSearchPlaceholder}
        resultsAriaLabel={copy.workoutLog.planSearchResults}
        emptyText={copy.workoutLog.noMatchingPlans}
        options={plans.map(p => ({
          key: p.id,
          label: p.name,
          onSelect: () => handlePlanSelect(p.id)
        }))}
      />
    </>
  );
}
