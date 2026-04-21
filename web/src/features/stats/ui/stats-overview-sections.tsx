"use client";

import Link from "next/link";
import { memo } from "react";
import { useLocale } from "@/components/locale-provider";
import { PageHeader, SectionHeading, StateBlock } from "@/components/ui/page-layout";
import { APP_ROUTES } from "@/lib/app-routes";
import type { StatsBundleResult } from "@/server/stats/bundle-service";

const CAPS_LABEL_STYLE = {
  fontFamily: "var(--font-label-family)",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const;

export function StatsPageHeader() {
  const { locale } = useLocale();

  return (
    <PageHeader
      eyebrow={locale === "ko" ? "퍼포먼스" : "Performance"}
      title={locale === "ko" ? "통계" : "Stats"}
      description={
        locale === "ko"
          ? "훈련 성과, 볼륨 추이, 종목별 최고 기록을 분석합니다."
          : "Analyze training performance, volume trends, and exercise-specific records."
      }
    />
  );
}

export function StatsSectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return <SectionHeading eyebrow={label} title={title} description={description} />;
}

const ComplianceRow = memo(function ComplianceRow({
  row,
}: {
  row: StatsBundleResult["compliance90d"]["byPlan"][number];
}) {
  const { locale } = useLocale();
  const pct = Math.round(row.compliance * 100);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "12px 14px",
        borderRadius: "10px",
        background: "var(--color-surface-container-low)",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.planName}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {locale === "ko"
            ? `${row.done} / ${row.planned} 세션 완료`
            : `${row.done} / ${row.planned} sessions completed`}
        </div>
        <div
          style={{
            marginTop: "6px",
            height: "4px",
            borderRadius: "2px",
            background: "var(--color-surface-container)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(pct, 100)}%`,
              borderRadius: "2px",
              background:
                pct >= 80
                  ? "var(--color-success)"
                  : pct >= 50
                    ? "var(--color-action)"
                    : "var(--color-danger)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color:
              pct >= 80
                ? "var(--color-success)"
                : pct >= 50
                  ? "var(--color-action)"
                  : "var(--color-text-muted)",
          }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
});

const PrRow = memo(function PrRow({
  row,
}: {
  row: StatsBundleResult["prs90d"][number];
}) {
  const { locale } = useLocale();
  const improvement = row.improvement;
  const improvementColor =
    improvement > 0 ? "var(--color-success)" : "var(--color-text-muted)";

  return (
    <Link
      href={`${APP_ROUTES.statsHome}?exerciseId=${encodeURIComponent(row.exerciseId ?? "")}`}
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
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "3px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.exerciseName}
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            fontSize: "11px",
            color: "var(--color-text-muted)",
          }}
        >
          <span>
            {locale === "ko" ? "최신" : "Latest"}{" "}
            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {row.latest?.e1rm ?? "—"}kg
            </span>
          </span>
          <span>
            {locale === "ko" ? "최고" : "Best"}{" "}
            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {row.best?.e1rm ?? "—"}kg
            </span>
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: improvementColor,
            letterSpacing: "-0.3px",
          }}
        >
          {improvement > 0 ? `+${improvement}` : improvement === 0 ? "0.0" : improvement}
        </div>
        <div
          style={{
            ...CAPS_LABEL_STYLE,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--color-text-muted)",
          }}
        >
          IMPROVED
        </div>
      </div>
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 16,
          color: "var(--color-text-muted)",
          opacity: 0.5,
          flexShrink: 0,
          fontVariationSettings: "'FILL' 0, 'wght' 300",
        }}
        aria-hidden="true"
      >
        chevron_right
      </span>
    </Link>
  );
});

export function StatsPrSection({
  items,
}: {
  items: StatsBundleResult["prs90d"];
}) {
  const { locale } = useLocale();

  return (
    <div style={{ marginBottom: "var(--space-xl)" }}>
      <StatsSectionHeading
        label={locale === "ko" ? "개인 최고 기록" : "Personal Records"}
        title={locale === "ko" ? "PR 기록 추적" : "PR Tracking"}
        description={
          locale === "ko"
            ? "종목별 최고 기록과 기간 내 향상도"
            : "Review best lifts by exercise and improvement across the selected period."
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {items.length > 0 ? (
          items.map((row) => <PrRow key={row.exerciseId ?? row.exerciseName} row={row} />)
        ) : (
          <StateBlock
            title={locale === "ko" ? "표시할 PR 데이터가 없습니다" : "No PR data yet"}
            description={
              locale === "ko"
                ? "현재 선택한 기간에 개인 최고 기록 추이를 계산할 데이터가 없습니다."
                : "There is not enough data in the selected range to calculate personal record changes."
            }
            tone="accent"
          />
        )}
      </div>
    </div>
  );
}

export function StatsComplianceSection({
  items,
}: {
  items: StatsBundleResult["compliance90d"]["byPlan"];
}) {
  const { locale } = useLocale();

  return (
    <div style={{ marginBottom: "var(--space-xl)" }}>
      <StatsSectionHeading
        label={locale === "ko" ? "플랜 준수율" : "Plan Adherence"}
        title={locale === "ko" ? "플랜별 준수율" : "Plan Compliance"}
        description={
          locale === "ko"
            ? "기간 내 계획 대비 완료 세션 비율"
            : "See how many planned sessions were completed during the selected period."
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {items.length > 0 ? (
          items.map((row) => <ComplianceRow key={row.planId} row={row} />)
        ) : (
          <StateBlock
            title={locale === "ko" ? "준수율 데이터가 없습니다" : "No compliance data yet"}
            description={
              locale === "ko"
                ? "선택한 기간의 완료 세션이 없어 플랜 준수율을 계산할 수 없습니다."
                : "There are no completed sessions in the selected range to calculate plan compliance."
            }
            tone="neutral"
          />
        )}
      </div>
    </div>
  );
}
