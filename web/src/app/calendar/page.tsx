"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { extractSessionDate } from "@/lib/session-key";
import { buildTodayLogHref } from "@/lib/workout-links";
import { AppSelect } from "@/components/ui/form-controls";

type Plan = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  params: any;
  createdAt: string;
};

type RecentGeneratedSession = {
  id: string;
  sessionKey: string;
  updatedAt: string;
};

const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MONTH_NAMES = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
] as const;
const WEEKDAY_KOREAN = ["일", "월", "화", "수", "목", "금", "토"] as const;

function dateOnlyInTimezone(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function dateOnlyToUtcDate(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

function utcDateToDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const d = dateOnlyToUtcDate(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToDateOnly(d);
}

function monthStart(dateOnly: string) {
  const d = dateOnlyToUtcDate(dateOnly);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthGrid(dateOnly: string) {
  const start = monthStart(dateOnly);
  const d = dateOnlyToUtcDate(start);
  const offset = d.getUTCDay(); // Sunday start
  const gridStart = addDays(start, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function dayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
}

function getYear(dateOnly: string) {
  return Number(dateOnly.slice(0, 4));
}

function getMonth(dateOnly: string) {
  return Number(dateOnly.slice(5, 7));
}

function getDayOfWeek(dateOnly: string) {
  return dateOnlyToUtcDate(dateOnly).getUTCDay();
}

function formatKoreanDate(dateOnly: string) {
  const y = getYear(dateOnly);
  const m = getMonth(dateOnly);
  const d = dayOfMonth(dateOnly);
  const dow = getDayOfWeek(dateOnly);
  return `${y}년 ${m}월 ${d}일 ${WEEKDAY_KOREAN[dow]}요일`;
}

function daysBetween(aDateOnly: string, bDateOnly: string) {
  return Math.floor(
    (dateOnlyToUtcDate(aDateOnly).getTime() - dateOnlyToUtcDate(bDateOnly).getTime()) / 86_400_000,
  );
}

function computePlanContextForDate(plan: Plan | null, dateOnly: string) {
  if (!plan) return null;
  const params = plan.params ?? {};
  const mode = String(params.sessionKeyMode ?? "").toUpperCase();
  const startDate =
    typeof params.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
      ? params.startDate
      : null;

  let week = 1;
  let day = 1;
  let scheduleKey: string | null = null;
  let planned = true;

  if (startDate) {
    const delta = daysBetween(dateOnly, startDate);
    if (delta < 0) planned = false;
    const normalized = Math.max(0, delta);
    if (plan.type === "MANUAL") {
      const schedule = Array.isArray(params.schedule) ? params.schedule : [];
      const span = Math.max(1, schedule.length || 1);
      day = (normalized % span) + 1;
      week = Math.floor(normalized / span) + 1;
      if (schedule.length > 0) {
        scheduleKey = String(schedule[(day - 1) % schedule.length]);
      }
    } else {
      const sessionsPerWeek = Math.max(1, Number(params.sessionsPerWeek ?? 7));
      day = (normalized % sessionsPerWeek) + 1;
      week = Math.floor(normalized / sessionsPerWeek) + 1;
    }
  } else {
    planned = false;
  }

  const sessionKey = mode === "DATE" ? dateOnly : `W${week}D${day}`;
  return { planned, week, day, scheduleKey, sessionKey };
}

export default function CalendarPage() {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const today = useMemo(() => dateOnlyInTimezone(new Date(), timezone), [timezone]);

  const [anchorDate, setAnchorDate] = useState(() =>
    dateOnlyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    dateOnlyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const anchorMonthKey = useMemo(() => monthStart(anchorDate).slice(0, 7), [anchorDate]);
  const cells = useMemo(() => monthGrid(anchorDate), [anchorDate]);

  // Load plans
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "플랜을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load sessions for selected plan
  useEffect(() => {
    if (!planId) {
      setRecentSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "200");
        const res = await apiGet<{ items: RecentGeneratedSession[] }>(
          `/api/generated-sessions?${sp.toString()}`,
        );
        if (!cancelled) setRecentSessions(res.items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "세션을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Build lookup maps
  const generatedByDate = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      const dateOnly = extractSessionDate(session.sessionKey);
      if (!dateOnly) continue;
      const current = map.get(dateOnly);
      if (!current || new Date(current.updatedAt).getTime() < new Date(session.updatedAt).getTime()) {
        map.set(dateOnly, session);
      }
    }
    return map;
  }, [recentSessions]);

  const generatedByKey = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      map.set(session.sessionKey, session);
    }
    return map;
  }, [recentSessions]);

  function getSessionForDate(dateOnly: string): RecentGeneratedSession | null {
    const ctx = computePlanContextForDate(selectedPlan, dateOnly);
    const mode = String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase();
    if (mode === "DATE") return generatedByDate.get(dateOnly) ?? null;
    return ctx ? (generatedByKey.get(ctx.sessionKey) ?? null) : null;
  }

  function shiftMonth(delta: number) {
    const d = dateOnlyToUtcDate(anchorDate);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setAnchorDate(utcDateToDateOnly(d));
  }

  function goToToday() {
    setAnchorDate(today);
    setSelectedDate(today);
  }

  async function generateForDate(dateOnly: string) {
    if (!planId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiPost<{ session: any }>(`/api/plans/${planId}/generate`, {
        sessionDate: dateOnly,
        timezone,
      });
      setRecentSessions((prev) => {
        const next = [
          { id: res.session.id, sessionKey: res.session.sessionKey, updatedAt: res.session.updatedAt },
          ...prev.filter((p) => p.id !== res.session.id),
        ];
        return next.slice(0, 200);
      });
    } catch (e: any) {
      setError(e?.message ?? "세션 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedCtx = useMemo(
    () => computePlanContextForDate(selectedPlan, selectedDate),
    [selectedPlan, selectedDate],
  );
  const selectedSession = getSessionForDate(selectedDate);

  const selectedDayLabel = (() => {
    if (!selectedCtx) return null;
    if (selectedPlan?.type === "MANUAL" && selectedCtx.scheduleKey) return selectedCtx.scheduleKey;
    return `W${selectedCtx.week}D${selectedCtx.day}`;
  })();

  const workoutHref = planId
    ? buildTodayLogHref({ planId, date: selectedDate, autoGenerate: false })
    : APP_ROUTES.todayLog;

  return (
    <div className="native-page native-page-enter tab-screen ios-cal-screen momentum-scroll">
      {/* Plan selector bar */}
      {plans.length > 0 && (
        <div className="ios-cal-plan-bar">
          <AppSelect
            className="ios-cal-plan-select"
            wrapperClassName="ios-cal-plan-shell"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            aria-label="플랜 선택"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </AppSelect>
        </div>
      )}

      {/* Month navigation header */}
      <div className="ios-cal-header">
        <button
          className="ios-cal-nav-btn"
          onClick={() => shiftMonth(-1)}
          aria-label="이전 달"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button className="ios-cal-month-label" onClick={goToToday} aria-label="오늘로 이동">
          {getYear(anchorDate)}년 {MONTH_NAMES[getMonth(anchorDate) - 1]}
        </button>

        <button
          className="ios-cal-nav-btn"
          onClick={() => shiftMonth(1)}
          aria-label="다음 달"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Weekday header row */}
      <div className="ios-cal-weekdays" aria-hidden="true">
        {WEEKDAY_SHORT.map((name, i) => (
          <div key={name} className={`ios-cal-weekday${i === 0 ? " is-sun" : ""}`}>
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="ios-cal-grid" role="grid" aria-label="날짜 선택">
        {cells.map((dateOnly) => {
          const isToday = dateOnly === today;
          const isSelected = dateOnly === selectedDate;
          const isOutside = !dateOnly.startsWith(anchorMonthKey);
          const hasDot = !!selectedPlan && getSessionForDate(dateOnly) !== null;
          const dow = getDayOfWeek(dateOnly);

          return (
            <button
              key={dateOnly}
              role="gridcell"
              className={[
                "ios-cal-day",
                isToday ? "is-today" : "",
                isSelected ? "is-selected" : "",
                isOutside ? "is-outside" : "",
                dow === 0 ? "is-sun" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelectedDate(dateOnly)}
              aria-label={`${getYear(dateOnly)}년 ${getMonth(dateOnly)}월 ${dayOfMonth(dateOnly)}일`}
              aria-pressed={isSelected}
            >
              <span className="ios-cal-day-num">{dayOfMonth(dateOnly)}</span>
              {hasDot && <span className="ios-cal-day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="ios-cal-divider" role="separator" />

      {/* Selected date detail panel */}
      <div className="ios-cal-detail">
        <div className="ios-cal-detail-header">
          <span className="ios-cal-detail-date">{formatKoreanDate(selectedDate)}</span>
          {selectedDate === today && <span className="ios-cal-today-badge">오늘</span>}
        </div>

        {error && <div className="ios-cal-error">{error}</div>}

        {loading ? (
          <div className="ios-cal-loading">
            <span className="ios-cal-loading-dot" />
            <span className="ios-cal-loading-dot" />
            <span className="ios-cal-loading-dot" />
          </div>
        ) : !selectedPlan ? (
          <div className="ios-cal-empty-state">
            <p className="ios-cal-empty-text">플랜을 선택하면 날짜별 세션을 확인할 수 있습니다.</p>
          </div>
        ) : selectedSession ? (
          /* Session exists */
          <div className="ios-cal-session-card">
            <div className="ios-cal-session-card-left">
              <div className="ios-cal-session-dot-accent" aria-hidden="true" />
              <div className="ios-cal-session-info">
                <span className="ios-cal-session-key">{selectedSession.sessionKey}</span>
                {selectedDayLabel && selectedDayLabel !== selectedSession.sessionKey && (
                  <span className="ios-cal-session-label">{selectedDayLabel}</span>
                )}
                <span className="ios-cal-session-meta">
                  생성됨 · {new Date(selectedSession.updatedAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>
            <a className="ios-cal-action-btn ios-cal-action-btn--primary" href={workoutHref}>
              기록하기
            </a>
          </div>
        ) : (
          /* No session yet */
          <div className="ios-cal-no-session">
            <div className="ios-cal-session-card-left">
              <div className="ios-cal-session-dot-muted" aria-hidden="true" />
              <div className="ios-cal-session-info">
                <span className="ios-cal-session-key ios-cal-session-key--muted">
                  {selectedCtx?.planned ? selectedDayLabel ?? "세션 없음" : "즉시 생성 가능"}
                </span>
                <span className="ios-cal-session-meta">
                  {selectedCtx?.planned
                    ? "계획됐지만 아직 생성되지 않았습니다."
                    : "이 날짜는 플랜 범위 밖이거나 즉시 열기가 가능합니다."}
                </span>
              </div>
            </div>
            <div className="ios-cal-no-session-actions">
              <button
                className="ios-cal-action-btn ios-cal-action-btn--secondary"
                onClick={() =>
                  generateForDate(selectedDate).catch((e: any) =>
                    setError(e?.message ?? "세션 생성에 실패했습니다."),
                  )
                }
                disabled={generating}
              >
                {generating ? "생성 중…" : "세션 생성"}
              </button>
              <a className="ios-cal-action-btn ios-cal-action-btn--primary" href={workoutHref}>
                기록하기
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
