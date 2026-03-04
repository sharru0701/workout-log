export type ProgressionTargetDecisionPayload = {
  target: string;
  outcome: "SUCCESS" | "FAIL";
  eventType: "INCREASE" | "HOLD" | "RESET";
  reason: string;
  beforeWorkKg: number | null;
  afterWorkKg: number | null;
  deltaWorkKg: number | null;
};

export type ProgressionEventPayload = {
  id: string;
  eventType: string;
  programSlug: string;
  reason: string | null;
  createdAt: string;
  didAdvanceSession: boolean;
  targetDecisions: ProgressionTargetDecisionPayload[];
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
};

export type ProgressionSummaryPayload = {
  mode: "upsert" | "replay";
  applied: boolean;
  replayApplied: boolean;
  reason: string | null;
  eventType: string | null;
  programSlug: string | null;
  event: ProgressionEventPayload | null;
};

function eventLabel(eventType: string | null | undefined) {
  switch (String(eventType ?? "").toUpperCase()) {
    case "INCREASE":
      return "증량";
    case "RESET":
      return "리셋";
    case "HOLD":
      return "유지";
    case "ADVANCE_WEEK":
      return "세션 진행";
    default:
      return eventType ? String(eventType) : "미적용";
  }
}

function skipReasonLabel(reason: string) {
  const raw = reason.replace(/^skip:/, "");
  switch (raw) {
    case "no-plan":
      return "플랜 없음";
    case "disabled":
      return "플랜 자동 진행 OFF";
    case "no-root-program":
      return "루트 프로그램 없음";
    case "version-missing":
      return "프로그램 버전 없음";
    case "template-missing":
      return "템플릿 없음";
    case "unsupported-program":
      return "미지원 프로그램";
    case "forbidden-plan":
      return "플랜 권한 없음";
    case "log-missing":
      return "로그 없음";
    case "already-applied":
      return "이미 적용됨";
    default:
      return raw || reason;
  }
}

export function formatProgressionReason(reason: string | null | undefined) {
  const value = String(reason ?? "").trim();
  if (!value) return "";
  if (value.startsWith("increase:+")) {
    return `${value.replace("increase:+", "")} 증량`;
  }
  if (value.startsWith("reset:*")) {
    const factor = Number(value.replace("reset:*", ""));
    if (Number.isFinite(factor) && factor > 0) {
      return `${Math.round(factor * 100)}% 리셋`;
    }
    return "리셋";
  }
  if (value === "advance:session") return "다음 세션으로 진행";
  if (value === "hold:success-streak") return "성공 누적";
  if (value === "hold:failure-streak") return "실패 누적";
  if (value.startsWith("skip:")) return skipReasonLabel(value);
  if (value === "replay:updated") return "수정 로그 기준 재계산 완료";
  return value;
}

export function formatDecisionDelta(decision: ProgressionTargetDecisionPayload) {
  if (typeof decision.deltaWorkKg !== "number" || !Number.isFinite(decision.deltaWorkKg)) return null;
  if (decision.deltaWorkKg === 0) return "0kg";
  return `${decision.deltaWorkKg > 0 ? "+" : ""}${decision.deltaWorkKg}kg`;
}

export function summarizeProgression(summary: ProgressionSummaryPayload | null | undefined) {
  if (!summary) return null;
  const reasonText = formatProgressionReason(summary.reason);
  const event = summary.event;

  if (!event) {
    if (!summary.applied) {
      return reasonText ? `자동 진행 미적용: ${reasonText}` : "자동 진행 미적용";
    }
    if (summary.replayApplied) {
      return reasonText ? `자동 진행 재계산 완료: ${reasonText}` : "자동 진행 재계산 완료";
    }
    return reasonText ? `자동 진행 적용: ${reasonText}` : "자동 진행 적용됨";
  }

  const changed = event.targetDecisions.filter((d) => d.eventType === "INCREASE" || d.eventType === "RESET");
  const changedText = changed
    .slice(0, 2)
    .map((d) => {
      const delta = formatDecisionDelta(d);
      return delta ? `${d.target} ${delta}` : d.target;
    })
    .join(", ");
  const parts = [`자동 진행 ${eventLabel(event.eventType)}`];
  if (event.didAdvanceSession) parts.push("세션 진행");
  if (changedText) parts.push(changedText);
  if (reasonText) parts.push(reasonText);
  return parts.join(" · ");
}

export function progressionTone(summary: ProgressionSummaryPayload | null | undefined): "neutral" | "success" | "warning" {
  if (!summary) return "neutral";
  if (!summary.applied && String(summary.reason ?? "").startsWith("skip:")) return "warning";
  if (summary.event?.eventType === "RESET") return "warning";
  return "success";
}
