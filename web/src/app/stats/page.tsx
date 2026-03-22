"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DashboardHero,
  DashboardScreen,
  DashboardSection,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";
import { apiGet } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Stats1RMDetailed, type Stats1RMDetailedRef } from "./_components/stats-1rm-detailed";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { useSearchParams } from "next/navigation";
import React from "react";

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
  const [heroMetrics, setHeroMetrics] = useState<{ sessions: number; volume: number } | null>(null);
  
  const [compliance, setCompliance] = useState<any>(null);
  const [prs, setPrs] = useState<any>(null);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
  });

  useEffect(() => {
    const exerciseId = searchParams.get("exerciseId");
    const exerciseName = searchParams.get("exercise");
    
    if (exerciseId || exerciseName) {
      // 컴포넌트 마운트 및 데이터 로드 시간을 고려해 약간의 지연 후 선택
      const timer = setTimeout(() => {
        if (detailedRef.current) {
          detailedRef.current.selectExercise(exerciseId || exerciseName || "");
          detailedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // PERF: 5개 개별 요청 → 1개 번들 엔드포인트 호출로 단축 (5 RTT → 1 RTT)
  // /api/stats/bundle: sessions30d, tonnage30d, compliance90d, prs90d 서버 사이드 병렬 처리
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bundle = await apiGet<any>("/api/stats/bundle");
        if (cancelled) return;
        setHeroMetrics({
          sessions: bundle.sessions30d ?? 0,
          volume: bundle.tonnage30d ?? 0,
        });
        setCompliance(bundle.compliance90d ?? null);
        setPrs({ items: bundle.prs90d ?? [] });
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const formatVolumeValue = (kg: number) => {
    if (kg >= 1000) return (kg / 1000).toFixed(1);
    return String(kg);
  };

  const formatVolumeUnit = (kg: number) => {
    if (kg >= 1000) return "t";
    return "kg";
  };

  return (
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      
      <DashboardScreen>
        <DashboardHero
          tone="quiet"
          title="스트렝스 대시보드"
          description="최근 30일간의 훈련 성과입니다. 카드를 선택해 상세 추이를 분석하세요."
        />

        <div style={{ padding: "0 0 var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "-4px" }}>
          <Card padding="md" className="metric-badge metric-progress">
            <span className="metric-value">{heroMetrics?.sessions ?? "-"}</span>
            <span className="metric-label">30일 운동</span>
          </Card>
          
          <Card padding="md" className="metric-badge metric-volume">
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              <span className="metric-value">{heroMetrics ? formatVolumeValue(heroMetrics.volume) : "-"}</span>
              <span style={{ fontSize: "14px", color: "var(--text-meta)", fontWeight: 600 }}>{heroMetrics ? formatVolumeUnit(heroMetrics.volume) : ""}</span>
            </div>
            <span className="metric-label">누적 볼륨</span>
          </Card>
        </div>

        <div ref={detailedSectionRef} style={{ scrollMarginTop: "var(--space-md)" }}>
          <DashboardSection
            title="상세 추이 분석"
            description="운동별 e1RM 변화와 전체 기간 최고 기록을 상세하게 분석합니다."
          >
            <div style={{ padding: "0 0 var(--space-md) 0" }}>
              <Stats1RMDetailed ref={detailedRef} refreshTick={refreshTick} />
            </div>
          </DashboardSection>
        </div>

        <DashboardSection
          title="플랜별 준수율"
          description="최근 90일간 계획 대비 완료 세션 비율입니다."
        >
          <div style={{ padding: "0 0 var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {compliance?.byPlan?.length ? (
              compliance.byPlan.map((r: any) => (
                <Card 
                  key={r.planId} 
                  padding="md" 
                  className="metric-badge metric-progress"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      {/* INFO COLOR: plan-name */}
                      <div style={{ font: "var(--font-card-title)", color: "var(--text-plan-name)", marginBottom: "2px" }}>{r.planName}</div>
                      <div style={{ font: "var(--font-secondary)", color: "var(--text-meta)" }}>
                        {r.done} / {r.planned} 세션 완료
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {/* INFO COLOR: metric-percent */}
                      <div className="metric-value" style={{ color: "var(--text-metric-percent)", fontSize: "1.2rem" }}>
                        {Math.round(r.compliance * 100)}%
                      </div>
                      <div className="metric-label" style={{ fontSize: "10px" }}>COMPLIANCE</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-hint)" }}>데이터가 없습니다.</div>
            )}
          </div>
        </DashboardSection>

        <DashboardSection
          title="PR 기록 추적"
          description="종목별 최고 기록과 최신 기록을 비교합니다."
        >
          <div style={{ padding: "0 0 var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {prs?.items?.length ? (
              prs.items.map((r: any) => (
                <Card 
                  key={r.exerciseId ?? r.exerciseName} 
                  padding="md" 
                  className="metric-badge metric-1rm"
                  interactive
                  as={Link}
                  href={`${APP_ROUTES.statsHome}?exerciseId=${encodeURIComponent(r.exerciseId || "")}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      {/* INFO COLOR: exercise-name */}
                      <div style={{ font: "var(--font-card-title)", color: "var(--text-exercise-name)", marginBottom: "2px" }}>{r.exerciseName}</div>
                      <div style={{ display: "flex", gap: "var(--space-md)", font: "var(--font-secondary)", color: "var(--text-meta)" }}>
                        <span>
                          최신: <span style={{ color: "var(--text-metric-actual)" }}>{r.latest?.e1rm ?? "-"}kg</span>
                        </span>
                        <span>
                          최고: <span style={{ color: "var(--text-metric-weight)" }}>{r.best?.e1rm ?? "-"}kg</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div 
                        className="metric-value" 
                        style={{ 
                          color: r.improvement > 0 ? "var(--text-status-completed)" : "var(--text-status-rest)",
                          fontSize: "1.1rem"
                        }}
                      >
                        {r.improvement > 0 ? `+${r.improvement}` : r.improvement === 0 ? "0.0" : r.improvement}
                      </div>
                      <div className="metric-label" style={{ fontSize: "10px" }}>IMPROVED</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-hint)" }}>데이터가 없습니다.</div>
            )}
          </div>
        </DashboardSection>

      </DashboardScreen>
    </PullToRefreshShell>
  );
}
