"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { APP_ROUTES } from "@/lib/app-routes";
import { apiGet } from "@/lib/api";
import dynamic from "next/dynamic";
import type { Stats1RMDetailedRef } from "./_components/stats-1rm-detailed";

const Stats1RMDetailed = dynamic(
  () => import("./_components/stats-1rm-detailed").then((m) => ({ default: m.Stats1RMDetailed })),
  { ssr: false }
);
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { useSearchParams } from "next/navigation";
import React from "react";

const CAPS_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-label-family)",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

// ─── Sub-components ───────────────────────────────────────────────

function SectionHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      <div style={{ ...CAPS_LABEL_STYLE, letterSpacing: "0.14em", color: "var(--color-action)", marginBottom: "2px" }}>
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
  const { locale } = useLocale();
  const pct = Math.round(r.compliance * 100);
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      padding: "12px 14px",
      borderRadius: "10px",
      background: "var(--color-surface-container-low)",
      boxShadow: "0 1px 3px var(--shadow-color-soft)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.planName}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {locale === "ko" ? `${r.done} / ${r.planned} 세션 완료` : `${r.done} / ${r.planned} sessions completed`}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: "6px", height: "4px", borderRadius: "2px", background: "var(--color-surface-container)", overflow: "hidden" }}>
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
  const { locale } = useLocale();
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
        background: "var(--color-surface-container-low)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
        textDecoration: "none",
        transition: "background 0.12s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.exerciseName}
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--color-text-muted)" }}>
          <span>{locale === "ko" ? "최신" : "Latest"} <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{r.latest?.e1rm ?? "—"}kg</span></span>
          <span>{locale === "ko" ? "최고" : "Best"} <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{r.best?.e1rm ?? "—"}kg</span></span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "15px", fontWeight: 800, color: impColor, letterSpacing: "-0.3px" }}>
          {imp > 0 ? `+${imp}` : imp === 0 ? "0.0" : imp}
        </div>
        <div style={{ ...CAPS_LABEL_STYLE, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
          IMPROVED
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)", opacity: 0.5, flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 300" }} aria-hidden="true">chevron_right</span>
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
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const detailedRef = useRef<Stats1RMDetailedRef>(null);
  const detailedSectionRef = useRef<HTMLDivElement>(null);
  const [refreshTick, setRefreshTick] = useState(0);
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
        const bundle = await apiGet<any>("/api/stats/bundle?days=90");
        if (cancelled) return;
        setCompliance(bundle.compliance90d ?? null);
        setPrs({ items: bundle.prs90d ?? [] });
      } catch (e) {
        console.error("Failed to load stats", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  return (
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      <div>

        {/* ── Page Header ── */}
        <div style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
        }}>
          <div style={{
            ...CAPS_LABEL_STYLE,
            letterSpacing: "0.14em",
            color: "var(--color-action)",
            marginBottom: "4px",
          }}>
            {locale === "ko" ? "퍼포먼스" : "Performance"}
          </div>
          <h1 style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "var(--color-text)",
            margin: 0,
          }}>
            {locale === "ko" ? "통계" : "Stats"}
          </h1>
          <p style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginTop: "4px",
            lineHeight: 1.5,
          }}>
            {locale === "ko" ? "훈련 성과, 볼륨 추이, 종목별 최고 기록을 분석합니다." : "Analyze training performance, volume trends, and exercise-specific records."}
          </p>
        </div>

        {/* ── Detailed 1RM Chart ── */}
        <div style={{ marginBottom: "var(--space-xl)" }} ref={detailedSectionRef}>
          <SectionHeading
            label={locale === "ko" ? "추이 분석" : "Trend Analysis"}
            title={locale === "ko" ? "상세 추이 분석" : "Detailed Trend Analysis"}
            description={locale === "ko" ? "운동별 e1RM 변화와 전체 기간 최고 기록" : "Track e1RM changes by exercise and best results across the selected range."}
          />
          <div style={{ marginTop: "var(--space-sm)" }}>
            <Stats1RMDetailed ref={detailedRef} refreshTick={refreshTick} />
          </div>
        </div>

        {/* ── PR Records ── */}
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <SectionHeading
            label={locale === "ko" ? "개인 최고 기록" : "Personal Records"}
            title={locale === "ko" ? "PR 기록 추적" : "PR Tracking"}
            description={locale === "ko" ? "종목별 최고 기록과 기간 내 향상도" : "Review best lifts by exercise and improvement across the selected period."}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{locale === "ko" ? "로딩 중…" : "Loading..."}</div>
            ) : prs?.items?.length ? (
              prs.items.map((r: any) => <PrRow key={r.exerciseId ?? r.exerciseName} r={r} />)
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{locale === "ko" ? "데이터가 없습니다." : "No data available."}</div>
            )}
          </div>
        </div>

        {/* ── Compliance ── */}
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <SectionHeading
            label={locale === "ko" ? "플랜 준수율" : "Plan Adherence"}
            title={locale === "ko" ? "플랜별 준수율" : "Plan Compliance"}
            description={locale === "ko" ? "기간 내 계획 대비 완료 세션 비율" : "See how many planned sessions were completed during the selected period."}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{locale === "ko" ? "로딩 중…" : "Loading..."}</div>
            ) : compliance?.byPlan?.length ? (
              compliance.byPlan.map((r: any) => <ComplianceRow key={r.planId} r={r} />)
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{locale === "ko" ? "데이터가 없습니다." : "No data available."}</div>
            )}
          </div>
        </div>

      </div>
    </PullToRefreshShell>
  );
}
