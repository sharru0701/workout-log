// v0.5.1 실패 프로토콜 피드백 훅 — progression-state 1회 fetch로 F1(조기 디로드 배너)·
// F2(진행 판정 카드)·F4(라이트 블록 배지)의 표출 상태를 얻는다. 배너·카드 문구는
// **서버가 조립**(feedback 필드 — core feedback-catalog 단일 진실원)하고, 여기는
// fetch·dismiss 영속화만 담당한다. TUI도 같은 서버 문구를 소비한다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import {
  isLightBlockActive,
  type FeedbackBanner,
  type ProgressReport,
  type ProgressionStateResponse,
} from "./progression-feedback";

const DISMISS_PREFIX = "wl.blockReport.dismissed.";

type ProgressionLoadState = {
  planId: string;
  data: ProgressionStateResponse | null;
  status: "loading" | "settled";
};

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
  const [loadState, setLoadState] = useState<ProgressionLoadState>(() => ({
    planId,
    data: null,
    status: planId ? "loading" : "settled",
  }));
  const [dismissTick, setDismissTick] = useState(0);

  useEffect(() => {
    if (!planId) {
      setLoadState({ planId: "", data: null, status: "settled" });
      return;
    }
    let cancelled = false;
    setLoadState({ planId, data: null, status: "loading" });
    (async () => {
      try {
        // 판정 직후의 배너/카드가 목적이라 캐시를 신뢰하지 않는다(network-only).
        const res = await apiGet<ProgressionStateResponse>(
          `/api/plans/${encodeURIComponent(planId)}/progression-state`,
          { cachePolicy: "network-only" },
        );
        if (!cancelled) setLoadState({ planId, data: res, status: "settled" });
      } catch {
        if (!cancelled) setLoadState({ planId, data: null, status: "settled" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, input.refreshKey]);

  const currentLoadState: ProgressionLoadState =
    loadState.planId === planId
      ? loadState
      : { planId, data: null, status: planId ? "loading" : "settled" };
  const data = currentLoadState.data;

  const feedback = data?.feedback ?? null;
  const isAsymptote = data?.program === "asymptote";

  const earlyDeloadBanner: FeedbackBanner | null = feedback?.earlyDeloadBanner ?? null;
  const showLightBlockBadge = isAsymptote && isLightBlockActive(data?.state ?? null);

  const blockReport: ProgressReport | null = useMemo(() => {
    const report = feedback?.report ?? null;
    if (!report) return null;
    void dismissTick; // dismiss 직후 재파생
    return isReportDismissed(report.eventId) ? null : report;
  }, [feedback?.report, dismissTick]);

  const dismissBlockReport = useCallback(() => {
    const eventId = feedback?.report?.eventId;
    if (!eventId) return;
    try {
      window.localStorage.setItem(DISMISS_PREFIX + eventId, "1");
    } catch {
      // storage 불가 환경(사파리 프라이빗 등)이면 세션 내 상태로만 닫는다.
    }
    setDismissTick((tick) => tick + 1);
  }, [feedback?.report?.eventId]);

  return {
    program: data?.program ?? null,
    ref5Status: data?.program === "ref5" ? data.ref5Status ?? null : null,
    progressionStateLoading: currentLoadState.status === "loading",
    progressionStateSettled: currentLoadState.status === "settled",
    earlyDeloadBanner,
    showLightBlockBadge,
    blockReport,
    dismissBlockReport,
  };
}
