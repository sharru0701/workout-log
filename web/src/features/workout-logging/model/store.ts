import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { WorkoutSession, WorkoutSet } from "@/lib/workout/session.types";
import { saveSession, debounce } from "@/lib/storage/workoutSession";
import { produce } from "immer";

const debouncedSave = debounce(
  (session: WorkoutSession) => saveSession(session),
  300
);

// 1. Primitive atoms
export const isRestoringAtom = atom(true);
export const sessionAtom = atom<WorkoutSession | null>(null);

// 2. Derived atom for persisting to storage whenever session changes
export const persistedSessionAtom = atom(
  (get) => get(sessionAtom),
  (get, set, newSession: WorkoutSession | null | ((prev: WorkoutSession | null) => WorkoutSession | null)) => {
    const nextSession = typeof newSession === 'function' ? newSession(get(sessionAtom)) : newSession;
    set(sessionAtom, nextSession);
    if (nextSession) {
      debouncedSave({ ...nextSession, updatedAt: Date.now() });
    }
  }
);

// 3. Actions / Derived setters
export const startSessionAtom = atom(null, (get, set, session: WorkoutSession) => {
  set(persistedSessionAtom, session);
  set(isRestoringAtom, false);
});

export const restoreSessionAtom = atom(null, (get, set, session: WorkoutSession) => {
  set(sessionAtom, session); // no debounce save on restore
  set(isRestoringAtom, false);
});

export const endSessionAtom = atom(null, (get, set) => {
  set(persistedSessionAtom, null);
});

export const updateSetAtom = atom(
  null,
  (get, set, { exerciseIndex, setIndex, setData }: { exerciseIndex: number; setIndex: number; setData: Partial<WorkoutSet> }) => {
    set(persistedSessionAtom, (prev) => {
      if (!prev) return prev;
      return produce(prev, (draft) => {
        const targetSet = draft.exercises[exerciseIndex]?.sets[setIndex];
        if (targetSet) {
          Object.assign(targetSet, setData);
        }
      });
    });
  }
);

export const toggleSetCompletionAtom = atom(
  null,
  (get, set, { exerciseIndex, setIndex }: { exerciseIndex: number; setIndex: number }) => {
    set(persistedSessionAtom, (prev) => {
      if (!prev) return prev;
      return produce(prev, (draft) => {
        const targetSet = draft.exercises[exerciseIndex]?.sets[setIndex];
        if (targetSet) {
          targetSet.completed = !targetSet.completed;
          draft.currentSetIndex = setIndex + 1;
        }
      });
    });
  }
);

export const goToNextExerciseAtom = atom(null, (get, set) => {
  set(persistedSessionAtom, (prev) => {
    if (!prev) return prev;
    return produce(prev, (draft) => {
      draft.currentExerciseIndex += 1;
      draft.currentSetIndex = 0;
    });
  });
});

export const startRestTimerAtom = atom(null, (get, set, durationSec: number) => {
  set(persistedSessionAtom, (prev) => {
    if (!prev) return prev;
    return produce(prev, (draft) => {
      draft.restTimer = {
        startedAt: Date.now(),
        durationSec,
      };
    });
  });
});

export const clearRestTimerAtom = atom(null, (get, set) => {
  set(persistedSessionAtom, (prev) => {
    if (!prev) return prev;
    return produce(prev, (draft) => {
      draft.restTimer.startedAt = null;
    });
  });
});
