"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, isAbortError } from "@/lib/api";
import { useLocale } from "@/components/locale-provider";
import type { StatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";
import { StatsScreen } from "./stats-screen";
import {
  buildStatsBootstrapPath,
  STATS_BOOTSTRAP_REQUEST_OPTIONS,
} from "./stats-bootstrap-request";

export function StatsContainer() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const [bootstrap, setBootstrap] = useState<StatsPageBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const path = buildStatsBootstrapPath(
      new URLSearchParams(searchParams?.toString() ?? ""),
    );
    setError(null);
    apiGet<StatsPageBootstrap>(path, {
      ...STATS_BOOTSTRAP_REQUEST_OPTIONS,
      signal: controller.signal,
    })
      .then((data) => {
        setBootstrap(data);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        setError(
          locale === "ko"
            ? "통계 데이터를 불러오지 못했습니다."
            : "Failed to load stats data.",
        );
      });
    return () => controller.abort();
  }, [locale, searchParams]);

  if (error) {
    return (
      <div style={{ padding: "var(--v2-s-6)" }}>
        <p className="v2-small" style={{ color: "var(--v2-c-danger)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div style={{ padding: "var(--v2-s-6)" }}>
        <p className="v2-small" style={{ color: "var(--v2-ink-2)" }}>
          {locale === "ko" ? "통계 데이터를 불러오는 중…" : "Loading stats…"}
        </p>
      </div>
    );
  }

  return <StatsScreen {...bootstrap} />;
}
