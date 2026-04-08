import { memo, useMemo } from "react";
import { AppPlusMinusIcon } from "./form-controls";
import { useLocale } from "@/components/locale-provider";
import { 
  resolveMinimumPlateIncrementKg,
} from "@/lib/settings/workout-preferences";
import type { WorkoutPreferences } from "@/lib/settings/workout-preferences";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { SearchSelectCombobox } from "@/shared/ui/search-select-sheet";
import { AppTextarea } from "@/shared/ui/form-controls";
import { WorkoutRecordInlinePicker } from "./inline-picker";
import Link from "next/link";
import { useState, useDeferredValue } from "react";

export type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
};

export type AddExerciseDraft = {
  exerciseId: string | null;
  exerciseName: string;
  repsPerSet: number[];
  weightKg: number;
  memo: string;
};

export const AddExerciseSheet = memo(function AddExerciseSheet({
  open,
  onClose,
  onAdd,
  exerciseOptions,
  preferences,
  recentLogItems,
  resolveWeightWithPreferences,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: AddExerciseDraft) => void;
  exerciseOptions: ExerciseOption[];
  preferences: WorkoutPreferences;
  recentLogItems: any[];
  resolveWeightWithPreferences: (w: number, id: string | null, name: string) => number;
}) {
  const { copy, locale } = useLocale();
  const [exerciseQuery, setExerciseQuery] = useState("");
  const deferredExerciseQuery = useDeferredValue(exerciseQuery);
  const [addDraft, setAddDraft] = useState<AddExerciseDraft>({
    exerciseId: null,
    exerciseName: "",
    repsPerSet: [5, 5, 5],
    weightKg: 50,
    memo: "",
  });
  const [error, setError] = useState<string | null>(null);

  const filteredOptions = useMemo(() => {
    const q = deferredExerciseQuery.trim().toLowerCase();
    if (!q) return exerciseOptions;
    return exerciseOptions.filter(o => 
      o.name.toLowerCase().includes(q) || 
      (o.category ?? "").toLowerCase().includes(q) ||
      o.aliases.some(a => a.toLowerCase().includes(q))
    );
  }, [deferredExerciseQuery, exerciseOptions]);

  const selectedOption = useMemo(() => 
    addDraft.exerciseId ? exerciseOptions.find(o => o.id === addDraft.exerciseId) : null
  , [addDraft.exerciseId, exerciseOptions]);

  const incrementKg = resolveMinimumPlateIncrementKg(preferences, {
    exerciseId: addDraft.exerciseId,
    exerciseName: addDraft.exerciseName,
  });

  const handleSelectOption = (option: ExerciseOption | null) => {
    if (!option) {
      setAddDraft(prev => ({ ...prev, exerciseId: null, exerciseName: "" }));
      return;
    }
    
    // Try to find recent weight for this exercise
    let baseWeight = 50;
    const normName = option.name.toLowerCase();
    for (const log of recentLogItems) {
      for (const set of log.sets) {
        if (set.exerciseName.toLowerCase() === normName && set.weightKg > 0) {
          baseWeight = set.weightKg;
          break;
        }
      }
      if (baseWeight !== 50) break;
    }

    setAddDraft(prev => ({
      ...prev,
      exerciseId: option.id,
      exerciseName: option.name,
      weightKg: resolveWeightWithPreferences(baseWeight, option.id, option.name),
    }));
    setError(null);
    setExerciseQuery("");
  };

  const handleAdd = () => {
    if (!addDraft.exerciseId) {
      setError(locale === "ko" ? "운동종목을 선택하세요." : "Select an exercise.");
      return;
    }
    onAdd(addDraft);
    onClose();
    // Reset state for next time
    setAddDraft({
      exerciseId: null,
      exerciseName: "",
      repsPerSet: [5, 5, 5],
      weightKg: 50,
      memo: "",
    });
  };

  return (
    <BottomSheet
      open={open}
      title={copy.workoutLog.addExerciseTitle}
      description={copy.workoutLog.addExerciseDescription}
      onClose={onClose}
      closeLabel={copy.workoutLog.close}
      primaryAction={{
        ariaLabel: copy.workoutLog.addExerciseAction,
        onPress: handleAdd,
        disabled: !addDraft.exerciseId,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <SearchSelectCombobox
          query={exerciseQuery}
          onQueryChange={setExerciseQuery}
          placeholder={locale === "ko" ? "예: Squat" : "e.g. Squat"}
          resultsAriaLabel={copy.workoutLog.exerciseSearchResults}
          emptyText={copy.workoutLog.noMatchingExercises}
          options={filteredOptions.map(o => ({
            key: o.id,
            label: o.category ? `${o.name} · ${o.category}` : o.name,
            onSelect: () => handleSelectOption(o),
          }))}
          selectionSummary={selectedOption ? (
            <div role="status" aria-live="polite" style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
              background: "var(--color-primary-weak)", borderRadius: "12px"
            }}>
               <span style={{ flex: 1 }}>{selectedOption.name}</span>
               <button onClick={() => handleSelectOption(null)}>{copy.workoutLog.change}</button>
            </div>
          ) : null}
          hideOptions={Boolean(selectedOption)}
        />
        {error && <p className="error-text">{error}</p>}

        {/* Set Configuration */}
        <div className="add-exercise-sets">
           {addDraft.repsPerSet.map((reps, i) => (
             <div key={i} className="add-set-row">
                <span>{i + 1}</span>
                <WorkoutRecordInlinePicker 
                  label={locale === "ko" ? `${i + 1}세트 무게` : `Set ${i + 1} Weight`}
                  value={addDraft.weightKg} 
                  min={0}
                  max={1000}
                  step={incrementKg}
                  onChange={v => setAddDraft(p => ({ ...p, weightKg: v }))}
                />
                <WorkoutRecordInlinePicker 
                  label={locale === "ko" ? `${i + 1}세트 횟수` : `Set ${i + 1} Reps`}
                  value={reps} 
                  min={1}
                  max={100}
                  step={1}
                  onChange={v => setAddDraft(p => {
                    const next = [...p.repsPerSet];
                    next[i] = v;
                    return { ...p, repsPerSet: next };
                  })}
                />
             </div>
           ))}
           <button 
             type="button"
             onClick={() => setAddDraft(p => ({ ...p, repsPerSet: [...p.repsPerSet, p.repsPerSet[p.repsPerSet.length-1] ?? 5] }))}
             style={{
               width: "100%",
               marginTop: "12px",
               padding: "10px",
               background: "var(--color-surface-container-high)",
               border: "none",
               borderRadius: "12px",
               color: "var(--color-text-muted)",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
               gap: "6px",
               fontFamily: "var(--font-label-family)",
               fontSize: "13px",
               fontWeight: 700,
               cursor: "pointer",
             }}
           >
             <AppPlusMinusIcon kind="plus" size={14} />
             <span>{copy.workoutLog.addSet}</span>
           </button>
        </div>

        <AppTextarea 
          value={addDraft.memo} 
          onChange={e => setAddDraft(p => ({ ...p, memo: e.target.value }))}
          placeholder="Memo"
        />

        <Link href="/workout/log/exercise-catalog" onClick={onClose} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "12px",
          borderRadius: "14px",
          background: "var(--color-surface-container)",
          color: "var(--color-text-muted)",
          textDecoration: "none",
          fontFamily: "var(--font-label-family)",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>tune</span>
          {locale === "ko" ? "운동종목 관리" : "Manage Exercises"}
        </Link>
      </div>
    </BottomSheet>
  );
});
