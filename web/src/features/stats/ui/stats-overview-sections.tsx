"use client";

import Link from "next/link";
import { memo } from "react";
import { useLocale } from "@/components/locale-provider";
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
    <div
      style={{
        marginBottom: "var(--space-xl)",
        paddingBottom: "var(--space-md)",
      }}
    >
      <div
        style={{
          ...CAPS_LABEL_STYLE,
          letterSpacing: "0.14em",
          color: "var(--color-action)",
          marginBottom: "4px",
        }}
      >
        {locale === "ko" ? "퍼포먼스" : "Performance"}
      </div>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        {locale === "ko" ? "통계" : "Stats"}
      </h1>
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text-muted)",
          marginTop: "4px",
          lineHeight: 1.5,
        }}
      >
        {locale === "ko"
          ? "훈련 성과, 볼륨 추이, 종목별 최고 기록을 분석합니다."
          : "Analyze training performance, volume trends, and exercise-specific records."}
      </p>
    </div>
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
  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      <div
        style={{
          ...CAPS_LABEL_STYLE,
          letterSpacing: "0.14em",
          color: "var(--color-action)",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "17px",
          fontWeight: 800,
          letterSpacing: "-0.3px",
          color: "var(--color-text)",
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
            marginTop: "2px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
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
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "13px",
            }}
          >
            {locale === "ko" ? "데이터가 없습니다." : "No data available."}
          </div>
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
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "13px",
            }}
          >
            {locale === "ko" ? "데이터가 없습니다." : "No data available."}
          </div>
        )}
      </div>
    </div>
  );
}
