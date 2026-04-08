import { memo } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatDateFriendly } from "@/lib/date";

export type LastSessionSummary = {
  weekLabel: string;
  sessionLabel: string;
  dateLabel: string;
  totalSets: number | null;
};

export const WorkoutLogHeader = memo(function WorkoutLogHeader({
  week,
  sessionType,
  completedCount,
  totalCount,
  sessionDate,
  bodyweightKg,
  isEditing,
}: {
  week: number;
  sessionType: string;
  completedCount: number;
  totalCount: number;
  sessionDate: string;
  bodyweightKg: number | null;
  isEditing: boolean;
}) {
  const { copy, locale } = useLocale();

  return (
    <div className="session-progress-header">
      <div className="session-progress-header__top-row">
        <div className="session-progress-header__title-group">
          <div className="session-progress-header__eyebrow">
            {isEditing ? copy.workoutLog.editingLog : copy.workoutLog.activeSession}
          </div>
          <h2 className="session-progress-header__title">
            Week {week} · {sessionType}
          </h2>
        </div>
      </div>
      <div className="session-progress-header__chips">
        <span className={`session-chip ${completedCount > 0 ? "session-chip--active" : ""}`}>
          {completedCount}/{totalCount} {copy.workoutLog.exercisesCount}
        </span>
        <span className="session-chip session-chip--date">
          {formatDateFriendly(sessionDate, locale)}
        </span>
        {bodyweightKg ? (
          <span className="session-chip">{copy.workoutLog.bodyweightShort} {bodyweightKg.toFixed(1)}kg</span>
        ) : null}
      </div>
    </div>
  );
});

export const LastSessionBanner = memo(function LastSessionBanner({
  lastSession,
}: {
  lastSession: LastSessionSummary | null;
}) {
  const { copy } = useLocale();
  if (!lastSession) return null;

  return (
    <div className="last-session-banner">
      <div className="last-session-banner__icon">
        <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>history</span>
      </div>
      <div className="last-session-banner__body">
        <div className="last-session-banner__label">{copy.workoutLog.lastSession}</div>
        <div className="last-session-banner__title">
          {lastSession.weekLabel} · {lastSession.sessionLabel}
        </div>
        <div className="last-session-banner__meta">{lastSession.dateLabel}</div>
      </div>
      {lastSession.totalSets != null && (
        <div className="last-session-banner__stat">
          <div className="last-session-banner__stat-value">{lastSession.totalSets}</div>
          <div className="last-session-banner__stat-label">{copy.workoutLog.sets}</div>
        </div>
      )}
    </div>
  );
});
