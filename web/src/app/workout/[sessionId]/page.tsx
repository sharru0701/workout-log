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
    <div className="fixed top-5 right-5 bg-green-500 text-white px-4 py-2 rounded-lg shadow-md animate-fade-in-out">
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
          className="px-4 py-2 bg-blue-500 text-white rounded"
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
          <div key={setIndex} className={`p-2 border rounded ${set.completed ? 'bg-gray-100' : ''}`}>
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
                className="px-2 py-1 bg-green-500 text-white rounded"
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
          className="mt-4 px-4 py-2 bg-purple-500 text-white rounded">
          Next Exercise
        </button>
      )}

      <button onClick={actions.endSession} className="mt-4 ml-4 px-4 py-2 bg-red-500 text-white rounded">
        End Workout
      </button>

      <ResilientTimer />
    </div>
  );
}
