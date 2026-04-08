"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  StatsComplianceSection,
  StatsPageHeader,
  StatsPrSection,
  StatsSectionHeading,
} from "@/features/stats/ui/stats-overview-sections";
import type { Stats1RMDetailedRef } from "@/features/stats/ui/stats-1rm-detailed";
import type { StatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";
import { useLocale } from "@/components/locale-provider";

const Stats1RMDetailed = dynamic(
  () =>
    import("@/features/stats/ui/stats-1rm-detailed").then((mod) => ({
      default: mod.Stats1RMDetailed,
    })),
  { ssr: false },
);

type StatsScreenProps = StatsPageBootstrap;

export function StatsScreen({
  initialBundle,
  initialExercises,
  initialPlans,
  initialE1rm,
  initialSelectedExerciseId,
  initialSelectedPlanId,
}: StatsScreenProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const detailedRef = useRef<Stats1RMDetailedRef>(null);
  const detailedSectionRef = useRef<HTMLDivElement>(null);
  const handledScrollRef = useRef<string | null>(null);

  useEffect(() => {
    const exerciseId = searchParams.get("exerciseId");
    const exerciseName = searchParams.get("exercise");
    const target = exerciseId ?? exerciseName ?? "";
    if (!target || handledScrollRef.current === target) return;

    handledScrollRef.current = target;
    requestAnimationFrame(() => {
      if (detailedRef.current) {
        detailedRef.current.selectExercise(target);
        detailedSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }, [searchParams]);

  return (
    <div>
      <StatsPageHeader />

      <div style={{ marginBottom: "var(--space-xl)" }} ref={detailedSectionRef}>
        <StatsSectionHeading
          label={locale === "ko" ? "추이 분석" : "Trend Analysis"}
          title={locale === "ko" ? "상세 추이 분석" : "Detailed Trend Analysis"}
          description={
            locale === "ko"
              ? "운동별 e1RM 변화와 전체 기간 최고 기록"
              : "Track e1RM changes by exercise and best results across the selected range."
          }
        />
        <div style={{ marginTop: "var(--space-sm)" }}>
          <Stats1RMDetailed
            ref={detailedRef}
            refreshTick={0}
            initialExercises={initialExercises}
            initialPlans={initialPlans}
            initialStats={initialE1rm}
            initialSelectedExerciseId={initialSelectedExerciseId}
            initialSelectedPlanId={initialSelectedPlanId}
          />
        </div>
      </div>

      <StatsPrSection items={initialBundle.prs90d} />
      <StatsComplianceSection items={initialBundle.compliance90d.byPlan} />
    </div>
  );
}
