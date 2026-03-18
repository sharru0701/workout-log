"use client";

import { useEffect } from 'react';
import { useWorkoutSession, useIsRestoring, useWorkoutActions } from '@/store/workoutStore';
import { useWorkoutPersistence } from '@/lib/workout/useWorkoutPersistence';
import { ResilientTimer } from '@/components/workout/resilient-timer';
import type { WorkoutSession } from '@/lib/workout/session.types';

// Dummy data for a new session
const createNewSession = (sessionId: string): WorkoutSession => ({
  sessionId,
  programId: 'program-1',
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  exercises: [
    { exerciseId: 'squat', sets: [{ weight: 0, reps: 0, completed: false }, { weight: 0, reps: 0, completed: false }] },
    { exerciseId: 'bench-press', sets: [{ weight: 0, reps: 0, completed: false }, { weight: 0, reps: 0, completed: false }] },
  ],
  restTimer: { startedAt: null, durationSec: 60 },
  updatedAt: Date.now(),
});

// A simple toast component for notifications
function Toast({ message, show, onDismiss }: { message: string; show: boolean; onDismiss: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onDismiss(), 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", backgroundColor: "var(--color-success)", color: "var(--color-text-on-primary)", padding: "8px 16px", borderRadius: "8px", boxShadow: "0 4px 12px var(--shadow-color-medium)" }}>
      {message}
    </div>
  );
}


export default function WorkoutPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const { showRestoredToast, setShowRestoredToast } = useWorkoutPersistence(sessionId);
  
  const session = useWorkoutSession();
  const isRestoring = useIsRestoring();
  const actions = useWorkoutActions();

  if (isRestoring) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <button
          onClick={() => actions.startSession(createNewSession(sessionId))}
          className="btn btn-primary"
        >
          Start New Workout
        </button>
      </div>
    );
  }

  const currentExercise = session.exercises[session.currentExerciseIndex];

  return (
    <div className="p-4">
      <Toast
        message="이전 운동을 복구했습니다."
        show={showRestoredToast}
        onDismiss={() => setShowRestoredToast(false)}
      />

      <h1 className="text-2xl font-bold mb-4">Workout in Progress</h1>
      <h2 className="text-xl capitalize mb-2">Exercise: {currentExercise.exerciseId}</h2>

      <div className="space-y-4">
        {currentExercise.sets.map((set, setIndex) => (
          <div key={setIndex} className="p-2 border rounded" style={set.completed ? { backgroundColor: "var(--color-surface-2)" } : undefined}>
            <p>Set {setIndex + 1}</p>
            <input
              type="number"
              value={set.weight}
              onChange={(e) => actions.updateSet(session.currentExerciseIndex, setIndex, { weight: Number(e.target.value) })}
              className="border p-1 mr-2"
              placeholder="Weight"
            />
            <input
              type="number"
              value={set.reps}
              onChange={(e) => actions.updateSet(session.currentExerciseIndex, setIndex, { reps: Number(e.target.value) })}
              className="border p-1 mr-2"
              placeholder="Reps"
            />
            {!set.completed && (
              <button
                onClick={() => {
                  actions.toggleSetCompletion(session.currentExerciseIndex, setIndex);
                  actions.startRestTimer(session.restTimer.durationSec);
                }}
                className="btn btn-primary"
              >
                Complete Set
              </button>
            )}
          </div>
        ))}
      </div>
      
      {session.currentExerciseIndex < session.exercises.length - 1 && (
        <button 
          onClick={actions.goToNextExercise} 
          className="btn btn-secondary" style={{ marginTop: "var(--space-md)" }}>
          Next Exercise
        </button>
      )}

      <button onClick={actions.endSession} className="btn btn-danger" style={{ marginTop: "var(--space-md)", marginLeft: "var(--space-md)" }}>
        End Workout
      </button>

      <ResilientTimer />
    </div>
  );
}
