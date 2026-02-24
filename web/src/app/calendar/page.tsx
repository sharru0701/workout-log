"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

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

function formatMonthLabel(dateOnly: string) {
  const d = dateOnlyToUtcDate(dateOnly);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [generatedSession, setGeneratedSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        setError(e?.message ?? "Failed to load plans");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!planId) {
        setRecentSessions([]);
        return;
      }
      try {
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "100");
        const res = await apiGet<{ items: RecentGeneratedSession[] }>(`/api/generated-sessions?${sp.toString()}`);
        setRecentSessions(res.items);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load generated sessions");
      }
    })();
  }, [planId]);

  const generatedByKey = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const s of recentSessions) map.set(s.sessionKey, s);
    return map;
  }, [recentSessions]);

  const cells = useMemo(() => (viewMode === "month" ? monthGrid(anchorDate) : weekGrid(anchorDate)), [anchorDate, viewMode]);
  const anchorMonthKey = useMemo(() => monthStart(anchorDate).slice(0, 7), [anchorDate]);
  const today = dateOnlyInTimezone(new Date(), timezone);

  const periodLabel = useMemo(() => {
    if (viewMode === "month") return formatMonthLabel(anchorDate);
    return `${cells[0]} to ${cells[cells.length - 1]}`;
  }, [anchorDate, cells, viewMode]);

  async function generateForDate(dateOnly: string) {
    if (!planId) throw new Error("Select a plan");
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

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="tab-screen-header">
        <h1 className="tab-screen-title">Calendar</h1>
        <p className="tab-screen-caption">
          {selectedPlan ? `${selectedPlan.name} · ${periodLabel}` : "Choose a plan to generate by date"}
        </p>
      </header>

      <section className="motion-card rounded-2xl border bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs text-neutral-600">plan</span>
          <select className="rounded-lg border px-3 py-3 text-base" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.length === 0 && <option value="">(no plans)</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.type}]
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">view</span>
          <select
            className="rounded-lg border px-3 py-3 text-base"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "month" | "week")}
          >
            <option value="month">month</option>
            <option value="week">week</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">anchor date</span>
          <input type="date" className="rounded-lg border px-3 py-3 text-base" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className="text-xs text-neutral-600">timezone</span>
          <input className="rounded-lg border px-3 py-3 text-base" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
      </section>

      <section className="motion-card rounded-2xl border bg-white calendar-nav-card">
        <div className="calendar-nav-row">
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => shift(-1)}>
            Prev
          </button>
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => setAnchorDate(today)}>
            Today
          </button>
          <button className="haptic-tap rounded-xl border px-4 py-3 text-sm font-medium" onClick={() => shift(1)}>
            Next
          </button>
        </div>
      </section>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <section className="motion-card rounded-2xl border bg-white p-3 space-y-3">
        <div className="calendar-grid-scroll">
          <div className="calendar-weekdays">
            {WEEKDAY_SHORT.map((name) => (
              <div key={name} className="calendar-weekday">{name}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((dateOnly) => {
              const ctx = computePlanContextForDate(selectedPlan, dateOnly);
              const generated = ctx ? generatedByKey.get(ctx.sessionKey) : undefined;
              const dayLabel =
                selectedPlan?.type === "MANUAL" && ctx?.scheduleKey
                  ? ctx.scheduleKey
                  : ctx
                    ? `W${ctx.week}D${ctx.day}`
                    : "No plan";
              const inAnchorMonth = viewMode === "week" || dateOnly.startsWith(anchorMonthKey);
              const isToday = dateOnly === today;
              const cellClass = `calendar-cell${inAnchorMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}${generated ? " is-generated" : ""}`;

              return (
                <article key={dateOnly} className={cellClass}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="calendar-cell-date">{dayOfMonth(dateOnly)}</div>
                    {isToday && <span className="text-[0.62rem] text-neutral-600">Today</span>}
                  </div>

                  <div className="calendar-cell-meta">{ctx?.planned ? `planned ${dayLabel}` : dayLabel}</div>
                  <div className="calendar-cell-meta">{generated ? "Generated" : ctx?.planned ? "Planned" : "On-demand"}</div>

                  <div className="calendar-cell-actions">
                    <button
                      className="calendar-cell-generate haptic-tap"
                      onClick={() => {
                        generateForDate(dateOnly).catch((e: any) => setError(e?.message ?? "Failed to generate"));
                      }}
                      disabled={!selectedPlan || loading}
                    >
                      Gen
                    </button>
                    {selectedPlan ? (
                      <a
                        className="calendar-cell-open"
                        href={`/workout/today?planId=${encodeURIComponent(planId)}&date=${encodeURIComponent(dateOnly)}&autoGenerate=1`}
                      >
                        Open
                      </a>
                    ) : (
                      <span className="calendar-cell-open opacity-55">Open</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-2">
        <div className="font-medium">Generated session</div>
        {generatedSession ? (
          <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
            {JSON.stringify(generatedSession.snapshot, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-neutral-600">Choose a date and press Generate.</div>
        )}
      </section>
    </div>
  );
}
