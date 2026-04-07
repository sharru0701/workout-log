"use client";

import { memo } from "react";
import { useExercise } from "@/store/workoutStore";
import { SetItem } from "./set-item";

interface ExerciseItemProps {
  exerciseIndex: number;
}

/**
 * ExerciseItem Component
 * PERF: Memoized to prevent re-renders unless the specific exercise data changes.
 * Iterates through sets and renders individual SetItem components.
 */
export const ExerciseItem = memo(function ExerciseItem({ exerciseIndex }: ExerciseItemProps) {
  const exercise = useExercise(exerciseIndex);

  if (!exercise) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="hd-welcome !p-0">
        <p className="text-xs uppercase tracking-widest text-primary font-bold mb-1">Current Exercise</p>
        <h2 className="text-3xl font-black capitalize tracking-tight text-text">
          {exercise.exerciseId.replace(/-/g, " ")}
        </h2>
      </div>

      <div className="space-y-3">
        {exercise.sets.map((_, setIndex) => (
          <SetItem 
            key={setIndex} 
            exerciseIndex={exerciseIndex} 
            setIndex={setIndex} 
          />
        ))}
      </div>
    </div>
  );
});
