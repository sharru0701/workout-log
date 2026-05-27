"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useAtomValue } from "jotai";
import { visibleExercisesAtom } from "@/features/workout-log/store/workout-log-atoms";
import type { WorkoutExerciseViewModel } from "@/lib/workout-record/model";

export type SetRowField = "weight" | "reps" | "rpe";

type CellEntry = {
  exerciseId: string;
  setIndex: number;
  field: SetRowField;
  input: HTMLInputElement | null;
};

export type SetRowFocusChainApi = {
  registerCell(
    exerciseId: string,
    setIndex: number,
    field: SetRowField,
    input: HTMLInputElement | null,
  ): void;
  unregisterCell(
    exerciseId: string,
    setIndex: number,
    field: SetRowField,
  ): void;
  registerCard(exerciseId: string, el: HTMLElement | null): void;
  unregisterCard(exerciseId: string): void;
  advanceFrom(from: {
    exerciseId: string;
    setIndex: number;
    field: SetRowField;
  }): boolean;
  focusFirstEmptyOf(exerciseId: string): void;
};

const FIELD_ORDER: SetRowField[] = ["weight", "reps", "rpe"];

const cellKey = (exerciseId: string, setIndex: number, field: SetRowField) =>
  `${exerciseId}:${setIndex}:${field}`;

const SetRowFocusChainContext = createContext<SetRowFocusChainApi | null>(null);

export function SetRowFocusChainProvider({
  apiRef,
  children,
}: {
  apiRef?: MutableRefObject<SetRowFocusChainApi | null>;
  children: ReactNode;
}) {
  const visibleExercises = useAtomValue(visibleExercisesAtom);
  const visibleRef = useRef<WorkoutExerciseViewModel[]>(visibleExercises);
  useEffect(() => {
    visibleRef.current = visibleExercises;
  });

  const cellsRef = useRef<Map<string, CellEntry>>(new Map());
  const cardsRef = useRef<Map<string, HTMLElement>>(new Map());

  // api는 ref 기반 stable singleton. 자식 useEffect deps에 들어가도
  // 매 렌더 새 객체로 인식되지 않도록 useState lazy initializer로 1회 init.
  const [api] = useState<SetRowFocusChainApi>(() => {
    const focusCell = (entry: CellEntry) => {
      if (!entry.input) return;
      entry.input.focus();
      try {
        entry.input.select();
      } catch {
        // ignore unsupported select
      }
      const card = cardsRef.current.get(entry.exerciseId);
      if (card?.scrollIntoView) {
        card.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    const nextCell = (from: {
      exerciseId: string;
      setIndex: number;
      field: SetRowField;
    }): CellEntry | null => {
      const exercises = visibleRef.current.filter((ex) => !ex.deleted);

      const fieldIdx = FIELD_ORDER.indexOf(from.field);
      for (let i = fieldIdx + 1; i < FIELD_ORDER.length; i++) {
        const c = cellsRef.current.get(
          cellKey(from.exerciseId, from.setIndex, FIELD_ORDER[i]!),
        );
        if (c?.input) return c;
      }

      const currentEx = exercises.find((ex) => ex.id === from.exerciseId);
      if (currentEx) {
        for (
          let s = from.setIndex + 1;
          s < currentEx.set.repsPerSet.length;
          s++
        ) {
          for (const f of FIELD_ORDER) {
            const c = cellsRef.current.get(cellKey(from.exerciseId, s, f));
            if (c?.input) return c;
          }
        }
      }

      const idx = exercises.findIndex((ex) => ex.id === from.exerciseId);
      if (idx === -1) return null;
      for (let i = idx + 1; i < exercises.length; i++) {
        const nextEx = exercises[i]!;
        for (let s = 0; s < nextEx.set.repsPerSet.length; s++) {
          for (const f of FIELD_ORDER) {
            const c = cellsRef.current.get(cellKey(nextEx.id, s, f));
            if (c?.input) return c;
          }
        }
      }
      return null;
    };

    return {
      registerCell(exerciseId, setIndex, field, input) {
        cellsRef.current.set(cellKey(exerciseId, setIndex, field), {
          exerciseId,
          setIndex,
          field,
          input,
        });
      },
      unregisterCell(exerciseId, setIndex, field) {
        cellsRef.current.delete(cellKey(exerciseId, setIndex, field));
      },
      registerCard(exerciseId, el) {
        if (el) {
          cardsRef.current.set(exerciseId, el);
        } else {
          cardsRef.current.delete(exerciseId);
        }
      },
      unregisterCard(exerciseId) {
        cardsRef.current.delete(exerciseId);
      },
      advanceFrom(from) {
        const next = nextCell(from);
        if (!next) return false;
        focusCell(next);
        return true;
      },
      focusFirstEmptyOf(exerciseId) {
        const ex = visibleRef.current.find(
          (e) => e.id === exerciseId && !e.deleted,
        );
        const card = cardsRef.current.get(exerciseId);
        if (card?.scrollIntoView) {
          card.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        if (!ex) return;
        for (let s = 0; s < ex.set.repsPerSet.length; s++) {
          const c = cellsRef.current.get(cellKey(exerciseId, s, "reps"));
          if (c?.input) {
            const v = (c.input.value ?? "").trim();
            if (!v || Number(v) <= 0) {
              focusCell(c);
              return;
            }
          }
        }
        const first = cellsRef.current.get(cellKey(exerciseId, 0, "reps"));
        if (first) focusCell(first);
      },
    };
  });

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [api, apiRef]);

  return (
    <SetRowFocusChainContext.Provider value={api}>
      {children}
    </SetRowFocusChainContext.Provider>
  );
}

export function useSetRowFocusChain(): SetRowFocusChainApi {
  const ctx = useContext(SetRowFocusChainContext);
  if (!ctx) {
    throw new Error(
      "useSetRowFocusChain must be used inside SetRowFocusChainProvider",
    );
  }
  return ctx;
}
