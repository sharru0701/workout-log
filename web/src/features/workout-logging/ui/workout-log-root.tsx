"use client";

import { useEffect, useState, useMemo } from "react";
import { useLocale } from "@/components/locale-provider";
import { WorkoutLogBoard } from "./workout-log-board";
import { 
  createWorkoutRecordDraft, 
  prepareWorkoutRecordDraftForEntry,
  WorkoutRecordDraft,
  WorkoutProgramExerciseEntryStateMap
} from "@/entities/workout";
import { generateWorkoutSessionAction } from "../api/actions";
import { WorkoutPreferences, readWorkoutPreferences } from "@/lib/settings/workout-preferences";
import WorkoutRecordLoading from "@/app/workout/log/loading";

export function WorkoutLogRoot({
  initialPlans,
  initialSettings,
  persistenceKey,
}: {
  initialPlans: any[];
  initialSettings: Record<string, any>;
  persistenceKey: string | null;
}) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
  const [entryState, setEntryState] = useState<WorkoutProgramExerciseEntryStateMap>({});
  
  const preferences = useMemo(() => {
    return readWorkoutPreferences(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    async function init() {
      // Try to generate initial session if no draft is restored
      // Restoration is handled inside WorkoutLogBoard, but we need an initial one to show something
      if (initialPlans.length > 0) {
        const plan = initialPlans[0];
        try {
          const res = await generateWorkoutSessionAction({ planId: plan.id });
          if (res.success && res.session) {
             const prepared = prepareWorkoutRecordDraftForEntry(
               createWorkoutRecordDraft(res.session, plan.name, { locale })
             );
             setDraft(prepared.draft);
             setEntryState(prepared.programEntryState);
          }
        } catch (e) {
          console.error("Failed to init workout session", e);
        }
      }
      setLoading(false);
    }
    init();
  }, [initialPlans, locale]);

  if (loading || !draft) {
    return <WorkoutRecordLoading />;
  }

  return (
    <WorkoutLogBoard 
      initialDraft={draft}
      initialEntryState={entryState}
      plans={initialPlans}
      recentLogItems={[]} // Fetch these as needed or pass from RSC
      exerciseOptions={[]} // Fetch these as needed
      preferences={preferences}
      lastSession={null} // Derive as needed
      persistenceKey={persistenceKey}
    />
  );
}
