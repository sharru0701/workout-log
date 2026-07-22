import { parseSessionKey } from "@workout/core/session-key";

/**
 * 세션 키에서 사이클/주차/일차 배지 문구를 만든다(C2W3D1 · W3D1).
 * 날짜형 키처럼 좌표가 없는 종류는 배지를 만들지 않는다.
 */
export function deriveSessionLabel(sessionKey: string | null | undefined): string | null {
  if (!sessionKey) return null;
  const parsed = parseSessionKey(sessionKey);
  if (!parsed) return null;
  if (parsed.kind === "cycle-wave" || parsed.kind === "date-progression") {
    return `C${parsed.cycle}W${parsed.week}D${parsed.day}`;
  }
  if (parsed.kind === "wave") {
    return `W${parsed.week}D${parsed.day}`;
  }
  return null;
}

/**
 * 헤더 eyebrow에 덧붙일 세션 타입 문구.
 * 배지와 같은 값이거나 배지의 일차를 되풀이하면(예: "W3D1" vs "…D1") 중복이라 생략한다.
 */
export function deriveSessionTypeLabel({
  sessionType,
  day,
  sessionLabel,
}: {
  sessionType: string | null | undefined;
  day: number | null | undefined;
  sessionLabel: string | null;
}): string | null {
  const trimmed = sessionType?.trim();
  if (!trimmed) return null;
  if (sessionLabel && trimmed === sessionLabel) return null;
  if (sessionLabel && trimmed.endsWith(`D${day ?? ""}`)) return null;
  return trimmed;
}

/** `YYYY-MM-DD`에 일수를 더해 같은 형식으로 돌려준다. 로컬 자정 기준(달·연 경계 자동 처리). */
export function addDaysToDateKey(dateKey: string, delta: number): string | null {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + delta);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
