"use client";

import { useState, useEffect, memo } from 'react';
import { useRestTimer, useWorkoutActions } from '@/store/workoutStore';

// Helper to format seconds into MM:SS
const formatTime = (seconds: number): string => {
  if (seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * ResilientTimer Component
 * PERF: Uses atomic 'useRestTimer' selector.
 * Memoized to prevent re-renders when other session data changes.
 * Uses requestAnimationFrame for smooth countdown.
 */
export const ResilientTimer = memo(function ResilientTimer() {
  const restTimer = useRestTimer();
  const { clearRestTimer } = useWorkoutActions();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const { startedAt, durationSec } = restTimer || {};

  useEffect(() => {
    if (!startedAt || !durationSec) {
      setRemainingSeconds(null);
      return;
    }

    let animationFrameId: number;

    const updateTimer = () => {
      const elapsedMs = Date.now() - startedAt;
      const remaining = durationSec - Math.floor(elapsedMs / 1000);
      
      setRemainingSeconds(remaining);

      if (remaining > 0) {
        animationFrameId = requestAnimationFrame(updateTimer);
      } else {
        // Timer finished, clear it from the central state
        clearRestTimer();
      }
    };

    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [startedAt, durationSec, clearRestTimer]);

  if (remainingSeconds === null || remainingSeconds < 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 p-6 rounded-2xl bg-surface-2 border border-border shadow-2xl z-50 animate-in zoom-in slide-in-from-bottom-4 duration-300">
      <div className="text-center">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-1">Resting</h3>
        <p className="text-5xl font-black font-mono tabular-nums text-primary">{formatTime(remainingSeconds)}</p>
      </div>
    </div>
  );
});
