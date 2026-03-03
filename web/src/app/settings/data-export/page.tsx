"use client";

import { useMemo, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { NoticeStateRows } from "@/components/ui/settings-state";

type ExportFormat = "json" | "csv";

function buildExportPath(format: ExportFormat) {
  if (format === "csv") {
    return "/api/export?format=csv&type=workout_set";
  }
  return "/api/export?format=json";
}

function buildFileName(format: ExportFormat) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return format === "csv" ? `workout-log-workout_set-${stamp}.csv` : `workout-log-export-${stamp}.json`;
}

async function shareOrDownloadExport(path: string, format: ExportFormat) {
  const response = await fetch(path, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? `Export 실패 (${response.status})`);
  }

  const blob = await response.blob();
  const fileName = buildFileName(format);
  const mimeType = format === "csv" ? "text/csv" : "application/json";
  const file = new File([blob], fileName, { type: mimeType });

  if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
    const sharePayload = {
      title: "Workout Log Export",
      text: "운동 데이터 백업 파일",
      files: [file],
    };
    try {
      const canShare = (navigator as Navigator & { canShare?: (data?: ShareData) => boolean }).canShare;
      if (canShare?.(sharePayload)) {
        await (navigator as Navigator & { share: (data?: ShareData) => Promise<void> }).share(sharePayload);
        return "shared";
      }
    } catch {
      // Fallback to local download.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 600);
  return "downloaded";
}

export default function SettingsDataExportPage() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportingLabel = useMemo(() => {
    if (!exporting) return null;
    return exporting === "json" ? "JSON 내보내기 중..." : "CSV 내보내기 중...";
  }, [exporting]);

  const runExport = async (format: ExportFormat) => {
    try {
      setExporting(format);
      setError(null);
      setNotice(null);
      const result = await shareOrDownloadExport(buildExportPath(format), format);
      if (result === "shared") {
        setNotice(format === "json" ? "JSON 파일을 ShareSheet로 공유했습니다." : "CSV 파일을 ShareSheet로 공유했습니다.");
      } else {
        setNotice(format === "json" ? "JSON 파일 다운로드를 시작했습니다." : "CSV 파일 다운로드를 시작했습니다.");
      }
    } catch (e: any) {
      setError(e?.message ?? "데이터 내보내기에 실패했습니다.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <NoticeStateRows message={notice} tone="success" label="Export 완료" />
      <NoticeStateRows message={error} tone="warning" label="Export 실패" />

      <section className="grid gap-2">
        <SectionHeader title="C-4 데이터 Export" description="Export는 iOS 표준 ShareSheet를 우선 사용합니다." />
        <BaseGroupedList ariaLabel="Data export actions">
          <NavigationRow
            label="JSON Export"
            subtitle="전체 백업"
            description="운동/플랜/세션 데이터를 구조형 JSON으로 내보냅니다."
            value={exporting === "json" ? "진행 중" : "공유"}
            onPress={() => {
              void runExport("json");
            }}
            disabled={Boolean(exporting)}
            leading={<RowIcon symbol="JS" tone="blue" />}
          />
          <NavigationRow
            label="CSV Export"
            subtitle="workout_set"
            description="분석용 테이블 CSV를 내보냅니다."
            value={exporting === "csv" ? "진행 중" : "공유"}
            onPress={() => {
              void runExport("csv");
            }}
            disabled={Boolean(exporting)}
            leading={<RowIcon symbol="CV" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>
          ShareSheet를 지원하지 않는 브라우저에서는 자동으로 파일 다운로드로 대체됩니다.
        </SectionFootnote>
      </section>

      {exportingLabel ? (
        <section className="grid gap-2">
          <article className="motion-card rounded-2xl border p-4 text-sm text-[var(--text-secondary)]">{exportingLabel}</article>
        </section>
      ) : null}
    </div>
  );
}
