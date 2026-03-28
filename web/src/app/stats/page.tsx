"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { apiGet } from "@/lib/api";
import { Stats1RMDetailed, type Stats1RMDetailedRef } from "./_components/stats-1rm-detailed";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { useSearchParams } from "next/navigation";
import React from "react";

// ─── Period filter ────────────────────────────────────────────────

type Period = { label: string; days: number };
const PERIODS: Period[] = [
  { label: "7D",  days: 7 },
  { label: "1M",  days: 30 },
  { label: "3M",  days: 90 },
  { label: "전체", days: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────

function formatVolume(kg: number): { value: string; unit: string } {
  if (kg >= 1000) return { value: (kg / 1000).toFixed(1), unit: "t" };
  return { value: String(kg), unit: "kg" };
}

function compliancePct(c: any): number {
  if (!c) return 0;
  return Math.round((c.compliance ?? 0) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────

function PeriodChips({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "var(--space-lg)" }}>
      {PERIODS.map((p) => {
        const active = p.days === value;
        return (
          <button
            key={p.days}
            type="button"
            onClick={() => onChange(p.days)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: `1px solid ${active ? "var(--color-selected-border)" : "var(--color-border)"}`,
              background: active ? "var(--color-action-weak)" : "var(--color-surface-2)",
              color: active ? "var(--color-action-strong)" : "var(--color-text-muted)",
              fontSize: "12px",
              fontWeight: active ? 700 : 600,
              letterSpacing: "0.05em",
              cursor: "pointer",
              transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function BentoMetrics({ sessions, volume, complianceData, topPr }: {
  sessions: number | null;
  volume: number | null;
  complianceData: any;
  topPr: any;
}) {
  const vol = volume !== null ? formatVolume(volume) : null;
  const pct = compliancePct(complianceData);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "auto auto",
      gap: "var(--space-sm)",
      marginBottom: "var(--space-xl)",
    }}>
      {/* Sessions — tall left */}
      <div style={{
        gridRow: "1 / 2",
        padding: "16px",
        borderRadius: "14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-metric-sets)", marginBottom: "8px" }}>Sessions</div>
        <div style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1.5px", color: "var(--color-text)", lineHeight: 1 }}>
          {sessions ?? "—"}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>운동 기록</div>
      </div>

      {/* Volume — top right */}
      <div style={{
        padding: "16px",
        borderRadius: "14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-metric-weight)", marginBottom: "8px" }}>Volume</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", color: "var(--color-text)", lineHeight: 1 }}>
            {vol?.value ?? "—"}
          </span>
          {vol && <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-muted)" }}>{vol.unit}</span>}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>누적 볼륨</div>
      </div>

      {/* Compliance — bottom left */}
      <div style={{
        padding: "16px",
        borderRadius: "14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-metric-reps)", marginBottom: "8px" }}>Compliance</div>
        <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-action)" : "var(--color-text)" }}>
          {complianceData !== null ? `${pct}%` : "—"}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>플랜 준수율</div>
      </div>

      {/* Top PR — bottom right */}
      <div style={{
        padding: "16px",
        borderRadius: "14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-cta)", marginBottom: "8px" }}>Top e1RM</div>
        {topPr ? (
          <>
            <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.8px", color: "var(--color-text)", lineHeight: 1 }}>
              {topPr.best?.e1rm ?? "—"}
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" }}> kg</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topPr.exerciseName}
            </div>
          </>
        ) : (
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-text)", lineHeight: 1 }}>—</div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-action)", marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-text)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px", lineHeight: 1.5 }}>{description}</div>
      )}
    </div>
  );
}

function ComplianceRow({ r }: { r: any }) {
  const pct = Math.round(r.compliance * 100);
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      padding: "12px 14px",
      borderRadius: "10px",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.planName}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {r.done} / {r.planned} 세션 완료
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: "6px", height: "4px", borderRadius: "2px", background: "var(--color-surface-2)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            borderRadius: "2px",
            background: pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-action)" : "var(--color-danger)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontSize: "20px",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-action)" : "var(--color-text-muted)",
        }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}

function PrRow({ r }: { r: any }) {
  const imp = r.improvement;
  const impColor = imp > 0 ? "var(--color-success)" : "var(--color-text-muted)";
  return (
    <Link
      href={`${APP_ROUTES.statsHome}?exerciseId=${encodeURIComponent(r.exerciseId || "")}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "12px 14px",
        borderRadius: "10px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        textDecoration: "none",
        transition: "background 0.12s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.exerciseName}
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--color-text-muted)" }}>
          <span>최신 <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{r.latest?.e1rm ?? "—"}kg</span></span>
          <span>최고 <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{r.best?.e1rm ?? "—"}kg</span></span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "15px", fontWeight: 800, color: impColor, letterSpacing: "-0.3px" }}>
          {imp > 0 ? `+${imp}` : imp === 0 ? "0.0" : imp}
        </div>
        <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          IMPROVED
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0, color: "var(--color-text-muted)", opacity: 0.5 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function StatsIndexPage() {
  return (
    <React.Suspense fallback={null}>
      <StatsPageContent />
    </React.Suspense>
  );
}

function StatsPageContent() {
  const searchParams = useSearchParams();
  const detailedRef = useRef<Stats1RMDetailedRef>(null);
  const detailedSectionRef = useRef<HTMLDivElement>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [period, setPeriod] = useState<number>(30);

  const [heroMetrics, setHeroMetrics] = useState<{ sessions: number; volume: number } | null>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [prs, setPrs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
  });

  useEffect(() => {
    const exerciseId = searchParams.get("exerciseId");
    const exerciseName = searchParams.get("exercise");
    if (exerciseId || exerciseName) {
      const timer = setTimeout(() => {
        if (detailedRef.current) {
          detailedRef.current.selectExercise(exerciseId || exerciseName || "");
          detailedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const bundle = await apiGet<any>(`/api/stats/bundle?days=${period}`);
        if (cancelled) return;
        setHeroMetrics({ sessions: bundle.sessions30d ?? 0, volume: bundle.tonnage30d ?? 0 });
        setCompliance(bundle.compliance90d ?? null);
        setPrs({ items: bundle.prs90d ?? [] });
      } catch (e) {
        console.error("Failed to load stats", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick, period]);

  return (
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      <div>

        {/* ── Page Header ── */}
        <div style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <div style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-action)",
            marginBottom: "4px",
          }}>
            Performance
          </div>
          <h1 style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "var(--color-text)",
            margin: 0,
          }}>
            Stats
          </h1>
          <p style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginTop: "4px",
            lineHeight: 1.5,
          }}>
            훈련 성과, 볼륨 추이, 종목별 최고 기록을 분석합니다.
          </p>
        </div>

        {/* ── Period Filter ── */}
        <PeriodChips value={period} onChange={setPeriod} />

        {/* ── Bento Metrics ── */}
        <BentoMetrics
          sessions={loading ? null : heroMetrics?.sessions ?? null}
          volume={loading ? null : heroMetrics?.volume ?? null}
          complianceData={loading ? null : compliance}
          topPr={loading ? null : prs?.items?.[0] ?? null}
        />

        {/* ── Detailed 1RM Chart ── */}
        <div style={{ marginBottom: "var(--space-xl)" }} ref={detailedSectionRef}>
          <SectionHeading
            label="Trend Analysis"
            title="상세 추이 분석"
            description="운동별 e1RM 변화와 전체 기간 최고 기록"
          />
          <div style={{ marginTop: "var(--space-sm)" }}>
            <Stats1RMDetailed ref={detailedRef} refreshTick={refreshTick} />
          </div>
        </div>

        {/* ── PR Records ── */}
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <SectionHeading
            label="Personal Records"
            title="PR 기록 추적"
            description="종목별 최고 기록과 기간 내 향상도"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>로딩 중…</div>
            ) : prs?.items?.length ? (
              prs.items.map((r: any) => <PrRow key={r.exerciseId ?? r.exerciseName} r={r} />)
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>데이터가 없습니다.</div>
            )}
          </div>
        </div>

        {/* ── Compliance ── */}
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <SectionHeading
            label="Plan Adherence"
            title="플랜별 준수율"
            description="기간 내 계획 대비 완료 세션 비율"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>로딩 중…</div>
            ) : compliance?.byPlan?.length ? (
              compliance.byPlan.map((r: any) => <ComplianceRow key={r.planId} r={r} />)
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>데이터가 없습니다.</div>
            )}
          </div>
        </div>

      </div>
    </PullToRefreshShell>
  );
}
