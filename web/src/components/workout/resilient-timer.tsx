"use client";

import { useState, useEffect } from 'react';
import { useWorkoutSession, useWorkoutActions } from '@/store/workoutStore';

// Helper to format seconds into MM:SS
const formatTime = (seconds: number): string => {
  if (seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export function ResilientTimer() {
  const session = useWorkoutSession();
  const { clearRestTimer } = useWorkoutActions();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const { startedAt, durationSec } = session?.restTimer || {};

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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 p-4 rounded-lg" style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)", boxShadow: "0 4px 12px var(--shadow-color-strong)" }}>
      <h3 className="text-lg font-bold">Rest Timer</h3>
      <p className="text-4xl font-mono">{formatTime(remainingSeconds)}</p>
    </div>
  );
}
