"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
  DashboardSection,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";
import { apiGet } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StrengthSummaryGrid } from "./_components/stats-summary-widgets";
import { Stats1RMDetailed, type Stats1RMDetailedRef } from "./_components/stats-1rm-detailed";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
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
  
  // 상세 데이터 상태 추가
  const [volumeSeries, setVolumeSeries] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [prs, setPrs] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
    triggerSelector: "[data-pull-refresh-trigger]",
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [uxRes, volumeRes] = await Promise.all([
          apiGet<any>("/api/stats/ux-snapshot?windows=30"),
          apiGet<any>("/api/stats/volume?days=30")
        ]);
        if (cancelled) return;
        setHeroMetrics({
          sessions: uxRes.funnel?.totals?.savedLogs ?? 0,
          volume: volumeRes.totals?.tonnage ?? 0
        });
      } catch (e) {
        console.error("Failed to load hero metrics", e);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingDetails(true);
        const [seriesRes, compRes, prsRes] = await Promise.all([
          apiGet<any>("/api/stats/volume-series?days=90&bucket=week&perExercise=1"),
          apiGet<any>("/api/stats/compliance?days=90&comparePrev=1"),
          apiGet<any>("/api/stats/prs?days=90&limit=10")
        ]);
        if (cancelled) return;
        setVolumeSeries(seriesRes);
        setCompliance(compRes);
        setPrs(prsRes);
      } catch (e) {
        console.error("Failed to load extended stats", e);
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const handleExerciseSelect = (id: string) => {
    detailedRef.current?.selectExercise(id);
    detailedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formatVolumeValue = (kg: number) => {
    if (kg >= 1000) return (kg / 1000).toFixed(1);
    return String(kg);
  };

  const formatVolumeUnit = (kg: number) => {
    if (kg >= 1000) return "t";
    return "kg";
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    return `${kg}kg`;
  };

  return (
    <div {...pullToRefresh.bind}>
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="통계 새로고침 중..."
        completeLabel="통계 갱신 완료"
      />
      
      <DashboardScreen>
        <DashboardHero
          tone="quiet"
          title="스트렝스 대시보드"
          description="최근 30일간의 훈련 성과입니다. 카드를 선택해 상세 추이를 분석하세요."
        />

        <div style={{ padding: "0 var(--space-md) var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "-4px" }}>
          <Card padding="md" className="metric-badge metric-progress">
            <span className="metric-value">{heroMetrics?.sessions ?? "-"}</span>
            <span className="metric-label">30일 운동</span>
          </Card>
          
          <Card padding="md" className="metric-badge metric-volume">
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              <span className="metric-value">{heroMetrics ? formatVolumeValue(heroMetrics.volume) : "-"}</span>
              <span style={{ fontSize: "14px", color: "var(--color-text-muted)", fontWeight: 600 }}>{heroMetrics ? formatVolumeUnit(heroMetrics.volume) : ""}</span>
            </div>
            <span className="metric-label">누적 볼륨</span>
          </Card>
        </div>

        <div ref={detailedSectionRef} style={{ scrollMarginTop: "var(--space-md)" }}>
          <DashboardSection
            title="상세 추이 분석"
            description="운동별 e1RM 변화와 전체 기간 최고 기록을 상세하게 분석합니다."
          >
            <div style={{ padding: "0 var(--space-md) var(--space-md) var(--space-md)" }}>
              <Stats1RMDetailed ref={detailedRef} refreshTick={refreshTick} />
            </div>
          </DashboardSection>
        </div>

        <DashboardSection
          title="플랜별 준수율"
          description="최근 90일간 계획 대비 완료 세션 비율입니다."
        >
          <div style={{ padding: "0 var(--space-md) var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {compliance?.byPlan?.length ? (
              compliance.byPlan.map((r: any) => (
                <Card 
                  key={r.planId} 
                  padding="md" 
                  className="metric-badge metric-progress"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ font: "var(--font-card-title)", marginBottom: "2px" }}>{r.planName}</div>
                      <div style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
                        {r.done} / {r.planned} 세션 완료
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="metric-value" style={{ color: "var(--color-primary)", fontSize: "1.2rem" }}>
                        {Math.round(r.compliance * 100)}%
                      </div>
                      <div className="metric-label" style={{ fontSize: "10px" }}>COMPLIANCE</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)" }}>데이터가 없습니다.</div>
            )}
          </div>
        </DashboardSection>

        <DashboardSection
          title="PR 기록 추적"
          description="종목별 최고 기록과 최신 기록을 비교합니다."
        >
          <div style={{ padding: "0 var(--space-md) var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
                      <div style={{ font: "var(--font-card-title)", marginBottom: "2px" }}>{r.exerciseName}</div>
                      <div style={{ display: "flex", gap: "var(--space-md)", font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
                        <span>최신: {r.latest?.e1rm ?? "-"}kg</span>
                        <span>최고: {r.best?.e1rm ?? "-"}kg</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div 
                        className="metric-value" 
                        style={{ 
                          color: r.improvement > 0 ? "var(--color-success)" : "var(--color-text-muted)",
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
              <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)" }}>데이터가 없습니다.</div>
            )}
          </div>
        </DashboardSection>

      </DashboardScreen>
    </div>
  );
}
