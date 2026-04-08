"use client";

import { useMemo, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { useLocale } from "@/components/locale-provider";
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

async function shareOrDownloadExport(
  path: string,
  format: ExportFormat,
  copy: ReturnType<typeof useLocale>["copy"],
) {
  const response = await fetch(path, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? copy.settings.dataExportPage.exportFailed(response.status));
  }

  const blob = await response.blob();
  const fileName = buildFileName(format);
  const mimeType = format === "csv" ? "text/csv" : "application/json";
  const file = new File([blob], fileName, { type: mimeType });

  if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
    const sharePayload = {
      title: copy.settings.dataExportPage.shareTitle,
      text: copy.settings.dataExportPage.shareText,
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
  const { copy } = useLocale();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportingLabel = useMemo(() => {
    if (!exporting) return null;
    return exporting === "json"
      ? copy.settings.dataExportPage.json.exporting
      : copy.settings.dataExportPage.csv.exporting;
  }, [copy.settings.dataExportPage.csv.exporting, copy.settings.dataExportPage.json.exporting, exporting]);

  const runExport = async (format: ExportFormat) => {
    try {
      setExporting(format);
      setError(null);
      setNotice(null);
      const result = await shareOrDownloadExport(buildExportPath(format), format, copy);
      if (result === "shared") {
        setNotice(format === "json" ? copy.settings.dataExportPage.json.shared : copy.settings.dataExportPage.csv.shared);
      } else {
        setNotice(format === "json" ? copy.settings.dataExportPage.json.downloaded : copy.settings.dataExportPage.csv.downloaded);
      }
    } catch (e: any) {
      setError(e?.message ?? copy.settings.dataExportPage.genericError);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <NoticeStateRows message={notice} tone="success" label={copy.settings.dataExportPage.noticeSuccess} />
      <NoticeStateRows message={error} tone="warning" label={copy.settings.dataExportPage.noticeError} />

      <section>
        <SectionHeader title={copy.settings.dataExportPage.title} description={copy.settings.dataExportPage.description} />
        <BaseGroupedList ariaLabel={copy.settings.dataExportPage.ariaLabel}>
          <NavigationRow
            label={copy.settings.dataExportPage.json.label}
            subtitle={copy.settings.dataExportPage.json.subtitle}
            description={copy.settings.dataExportPage.json.description}
            value={exporting === "json" ? copy.settings.dataExportPage.actionInProgress : copy.settings.dataExportPage.actionShare}
            onPress={() => {
              void runExport("json");
            }}
            disabled={Boolean(exporting)}
          />
          <NavigationRow
            label={copy.settings.dataExportPage.csv.label}
            subtitle={copy.settings.dataExportPage.csv.subtitle}
            description={copy.settings.dataExportPage.csv.description}
            value={exporting === "csv" ? copy.settings.dataExportPage.actionInProgress : copy.settings.dataExportPage.actionShare}
            onPress={() => {
              void runExport("csv");
            }}
            disabled={Boolean(exporting)}
          />
        </BaseGroupedList>
        <SectionFootnote>
          {copy.settings.dataExportPage.footnote}
        </SectionFootnote>
      </section>

      {exportingLabel ? (
        <section>
          <div style={{ background: "var(--color-surface-container-low)", borderRadius: 20, padding: "var(--space-md)", boxShadow: "0 1px 3px var(--shadow-color-soft)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-label-family)", fontSize: 13, color: "var(--color-text-muted)" }}>{exportingLabel}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
