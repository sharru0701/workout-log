"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardHero, DashboardSection, DashboardSurface } from "@/components/dashboard/dashboard-primitives";
import { apiGet, apiPost } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { extractSessionDate } from "@/lib/session-key";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { buildTodayLogHref } from "@/lib/workout-links";

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

function weekGrid(dateOnly: string) {
  const d = dateOnlyToUtcDate(dateOnly);
  const offset = d.getUTCDay(); // Sunday start
  const weekStart = addDays(dateOnly, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function daysBetween(aDateOnly: string, bDateOnly: string) {
  return Math.floor((dateOnlyToUtcDate(aDateOnly).getTime() - dateOnlyToUtcDate(bDateOnly).getTime()) / 86_400_000);
}

function dayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
}

function computePlanContextForDate(plan: Plan | null, dateOnly: string) {
  if (!plan) return null;
  const params = plan.params ?? {};
  const mode = String(params.sessionKeyMode ?? "").toUpperCase();
  const startDate = typeof params.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
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
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [anchorDate, setAnchorDate] = useState(() => dateOnlyInTimezone(new Date(), timezone));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [openAutoGenerate, setOpenAutoGenerate] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [generatedSession, setGeneratedSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoadKey, setPlansLoadKey] = useState("calendar-manage:init");

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const isPlansSettled = useQuerySettled(plansLoadKey, loading);
  const openActionLabel = openAutoGenerate ? "자동 생성" : "열기만";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setPlansLoadKey(`calendar-manage:${Date.now()}`);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!planId) {
        if (!cancelled) setRecentSessions([]);
        return;
      }
      try {
        setLoading(true);
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "100");
        const res = await apiGet<{ items: RecentGeneratedSession[] }>(`/api/generated-sessions?${sp.toString()}`);
        if (!cancelled) setRecentSessions(res.items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "생성된 세션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId]);

  const generatedByKey = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      map.set(session.sessionKey, session);
    }
    return map;
  }, [recentSessions]);

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

  const cells = useMemo(() => (viewMode === "month" ? monthGrid(anchorDate) : weekGrid(anchorDate)), [anchorDate, viewMode]);
  const anchorMonthKey = useMemo(() => monthStart(anchorDate).slice(0, 7), [anchorDate]);
  const today = dateOnlyInTimezone(new Date(), timezone);

  async function generateForDate(dateOnly: string) {
    if (!planId) throw new Error("플랜을 먼저 선택하세요.");
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ session: any }>(`/api/plans/${planId}/generate`, {
        sessionDate: dateOnly,
        timezone,
      });
      setGeneratedSession(res.session);
      setRecentSessions((prev) => {
        const next = [
          {
            id: res.session.id,
            sessionKey: res.session.sessionKey,
            updatedAt: res.session.updatedAt,
          },
          ...prev.filter((p) => p.id !== res.session.id),
        ];
        return next.slice(0, 100);
      });
    } finally {
      setLoading(false);
    }
  }

  function shift(delta: number) {
    if (viewMode === "month") {
      const d = dateOnlyToUtcDate(anchorDate);
      d.setUTCMonth(d.getUTCMonth() + delta);
      setAnchorDate(utcDateToDateOnly(d));
    } else {
      setAnchorDate(addDays(anchorDate, delta * 7));
    }
  }

  function workoutTodayHrefForDate(dateOnly: string) {
    return buildTodayLogHref({
      planId,
      date: dateOnly,
      autoGenerate: openAutoGenerate,
    });
  }

  return (
    <div className="native-page native-page-enter tab-screen app-dashboard-screen momentum-scroll">
      <DashboardHero
        eyebrow="캘린더 작업"
        title="날짜 기준 세션 관리"
        description="이 화면은 선택한 플랜을 날짜와 연결하는 작업 화면입니다. 날짜를 눌러 오늘 기록 화면으로 열거나 자동 생성까지 이어질 수 있습니다."
        primaryAction={{ href: APP_ROUTES.calendarOptions, label: "열기 규칙 설정", tone: "secondary" }}
        secondaryAction={{ href: APP_ROUTES.todayLog, label: "오늘 기록", tone: "primary" }}
        metrics={[
          { label: "선택 플랜", value: selectedPlan?.name ?? "없음" },
          { label: "보기", value: viewMode === "month" ? "월" : "주" },
          { label: "열기", value: openActionLabel },
        ]}
        tone="accent"
      />

      <DashboardSection
        title="캘린더 컨트롤"
        description="플랜, 보기, 날짜, 열기 동작을 한 묶음으로 유지해 상단 인지 부하를 줄였습니다."
      >
        <DashboardSurface className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="ui-card-label">플랜</span>
          <AppSelect value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.length === 0 && <option value="">플랜 없음</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.type}]
              </option>
            ))}
          </AppSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="ui-card-label">보기 방식</span>
          <AppSelect
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "month" | "week")}
          >
            <option value="month">월</option>
            <option value="week">주</option>
          </AppSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="ui-card-label">기준 날짜</span>
          <AppTextInput type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="ui-card-label">날짜 열기 동작</span>
          <AppSelect
            value={openAutoGenerate ? "AUTO_GENERATE" : "OPEN_ONLY"}
            onChange={(e) => setOpenAutoGenerate(e.target.value === "AUTO_GENERATE")}
          >
            <option value="OPEN_ONLY">해당 날짜만 열기</option>
            <option value="AUTO_GENERATE">열고 바로 세션 생성</option>
          </AppSelect>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-5">
          <span className="ui-card-label">시간대</span>
          <AppTextInput value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
        </DashboardSurface>

        <DashboardSurface className="calendar-nav-card">
          <div className="calendar-nav-row">
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => shift(-1)}>
            이전
          </button>
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => setAnchorDate(today)}>
            오늘
          </button>
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => shift(1)}>
            다음
          </button>
          </div>
        </DashboardSurface>
      </DashboardSection>

      <LoadingStateRows
        active={loading}
        label="불러오는 중"
      />
      <ErrorStateRows
        message={error}
        onRetry={() => {
          setError(null);
          (async () => {
            try {
              const plansRes = await apiGet<{ items: Plan[] }>("/api/plans");
              setPlans(plansRes.items);
              const nextPlanId = plansRes.items.some((p) => p.id === planId) ? planId : (plansRes.items[0]?.id ?? "");
              setPlanId(nextPlanId);

              if (!nextPlanId) {
                setRecentSessions([]);
                return;
              }

              const sp = new URLSearchParams();
              sp.set("planId", nextPlanId);
              sp.set("limit", "100");
              const sessionsRes = await apiGet<{ items: RecentGeneratedSession[] }>(`/api/generated-sessions?${sp.toString()}`);
              setRecentSessions(sessionsRes.items);
            } catch (e: any) {
              setError(e?.message ?? "캘린더 컨텍스트를 다시 불러오지 못했습니다.");
            }
          })();
        }}
      />
      <EmptyStateRows
        when={isPlansSettled && plans.length === 0}
        label="설정 값 없음"
        description="사용 가능한 플랜이 없습니다. 플랜 화면에서 먼저 생성하세요."
      />
      <DisabledStateRows
        when={!selectedPlan}
        label="플랜 미선택"
        description="플랜을 선택하면 날짜별 생성/열기 동작이 활성화됩니다."
      />

      <DashboardSection
        title="캘린더 그리드"
        description="날짜별 생성 상태와 바로 열기 동작을 같은 그리드에서 유지합니다."
      >
        <DashboardSurface className="p-3 space-y-3">
        <div className="calendar-grid-scroll">
          <div className="calendar-weekdays">
            {WEEKDAY_SHORT.map((name) => (
              <div key={name} className="calendar-weekday">{name}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((dateOnly) => {
              const ctx = computePlanContextForDate(selectedPlan, dateOnly);
              const generated =
                String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase() === "DATE"
                  ? generatedByDate.get(dateOnly)
                  : (ctx ? generatedByKey.get(ctx.sessionKey) : undefined);
              const dayLabel =
                selectedPlan?.type === "MANUAL" && ctx?.scheduleKey
                  ? ctx.scheduleKey
                  : ctx
                    ? `W${ctx.week}D${ctx.day}`
                    : "플랜 없음";
              const inAnchorMonth = viewMode === "week" || dateOnly.startsWith(anchorMonthKey);
              const isToday = dateOnly === today;
              const cellClass = `calendar-cell${inAnchorMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}${generated ? " is-generated" : ""}`;

              return (
                <article key={dateOnly} className={cellClass}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="calendar-cell-date">{dayOfMonth(dateOnly)}</div>
                    {isToday && <span className="text-[0.62rem] text-neutral-600">오늘</span>}
                  </div>

                  <div className="calendar-cell-meta">{ctx?.planned ? `계획 ${dayLabel}` : dayLabel}</div>
                  <div className="calendar-cell-meta">
                    <span className={`calendar-cell-status${generated ? " is-generated" : ctx?.planned ? " is-planned" : " is-on-demand"}`}>
                      {generated ? "생성됨" : ctx?.planned ? "계획됨" : "즉시 생성"}
                    </span>
                  </div>

                  <div className="calendar-cell-actions">
                    <button
                      className="calendar-cell-generate haptic-tap"
                      onClick={() => {
                        generateForDate(dateOnly).catch((e: any) => setError(e?.message ?? "생성에 실패했습니다."));
                      }}
                      disabled={!selectedPlan || loading}
                    >
                      생성
                    </button>
                    {selectedPlan ? (
                      <a
                        className="calendar-cell-open"
                        href={workoutTodayHrefForDate(dateOnly)}
                      >
                        날짜 열기
                      </a>
                    ) : (
                      <span className="calendar-cell-open opacity-55">날짜 열기</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        </DashboardSurface>
      </DashboardSection>

      <DashboardSection
        title="생성 세션"
        description="선택한 날짜로 생성한 세션 스냅샷을 유지합니다."
      >
        <DashboardSurface className="space-y-2">
        {generatedSession ? (
          <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
            {JSON.stringify(generatedSession.snapshot, null, 2)}
          </pre>
        ) : (
          <EmptyStateRows
            when
            label="설정 값 없음"
            description="날짜를 선택한 뒤 생성을 실행하면 세션 스냅샷이 표시됩니다."
          />
        )}
        </DashboardSurface>
      </DashboardSection>
    </div>
  );
}
