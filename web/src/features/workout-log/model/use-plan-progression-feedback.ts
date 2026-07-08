// v0.5.1 실패 프로토콜 피드백 훅 — progression-state 1회 fetch로 F1(조기 디로드 배너)·
// F2(블록 판정 카드)·F4(라이트 블록 배지)의 표출 상태를 파생한다. 판정 파생은 전부
// progression-feedback.ts(순수·테스트 대상)에 위임하고, 여기는 fetch·dismiss 영속화만 담당.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  buildProgressReport,
  isLightBlockActive,
  shouldShowEarlyDeloadBanner,
  type ProgressReport,
  type ProgressionStateResponse,
} from "./progression-feedback";

const DISMISS_PREFIX = "wl.blockReport.dismissed.";

function isReportDismissed(eventId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + eventId) === "1";
  } catch {
    return true;
  }
}

export function usePlanProgressionFeedback(input: {
  planId: string | null | undefined;
  // 저장 후 최신 이벤트를 다시 읽도록 하는 키(예: 현재 로그 id). 변경 시 refetch.
  refreshKey?: string | null;
  locale: "ko" | "en";
}) {
  const planId = typeof input.planId === "string" ? input.planId : "";
  const [data, setData] = useState<ProgressionStateResponse | null>(null);
  const [dismissTick, setDismissTick] = useState(0);

  useEffect(() => {
    if (!planId) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 판정 직후의 배너/카드가 목적이라 캐시를 신뢰하지 않는다(network-only).
        const res = await apiGet<ProgressionStateResponse>(
          `/api/plans/${encodeURIComponent(planId)}/progression-state`,
          { cachePolicy: "network-only" },
        );
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, input.refreshKey]);

  const lastEvent = data?.lastEvent ?? null;
  const isAsymptote = data?.program === "asymptote";

  const showEarlyDeloadBanner = shouldShowEarlyDeloadBanner({
    program: data?.program ?? null,
    state: data?.state ?? null,
    lastEvent,
  });

  const showLightBlockBadge = isAsymptote && isLightBlockActive(data?.state ?? null);

  // 진행 판정 카드 — 프로그램 공통(패밀리별 카탈로그 + 폴백). 노이즈 필터링·문구는
  // buildProgressReport가 담당하므로 여기서 패밀리를 가리지 않는다.
  const blockReport: ProgressReport | null = useMemo(() => {
    const report = buildProgressReport(data?.program ?? null, lastEvent, input.locale);
    if (!report) return null;
    void dismissTick; // dismiss 직후 재파생
    return isReportDismissed(report.eventId) ? null : report;
  }, [data?.program, lastEvent, input.locale, dismissTick]);

  const dismissBlockReport = useCallback(() => {
    if (!lastEvent) return;
    try {
      window.localStorage.setItem(DISMISS_PREFIX + lastEvent.id, "1");
    } catch {
      // storage 불가 환경(사파리 프라이빗 등)이면 세션 내 상태로만 닫는다.
    }
    setDismissTick((tick) => tick + 1);
  }, [lastEvent]);

  return {
    program: data?.program ?? null,
    earlyDeloadReason: lastEvent?.reason ?? null,
    showEarlyDeloadBanner,
    showLightBlockBadge,
    blockReport,
    dismissBlockReport,
  };
}
