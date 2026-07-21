/**
 * 활성 플랜 — "지금 진행 중인 플랜"의 단일 소스.
 *
 * 이전에는 화면마다 다른 휴리스틱을 썼다: 홈은 최근 수행 플랜(lastPerformedAt),
 * 기록/캘린더는 최근 생성 플랜(createdAt). 그래서 새 플랜을 시작하면 기록 화면은
 * 새 플랜을, 홈은 여전히 옛 플랜을 가리켰고, 홈 CTA로 운동하면 옛 플랜의
 * lastPerformedAt이 다시 갱신되어 새 플랜이 영영 뒤로 밀리는 루프가 생겼다.
 *
 * 이제 사용자가 마지막으로 "이 플랜으로 한다"고 표현한 선택(프로그램 시작,
 * 플랜 전환)을 user_setting에 적어두고 모든 화면이 그것을 먼저 본다.
 * 설정이 없거나 가리키는 플랜이 사라졌으면 기존 휴리스틱으로 자연스럽게 되돌아간다.
 */

export const ACTIVE_PLAN_SETTING_KEY = "state.activePlanId";

export type ActivePlanCandidate = {
  id: string;
  isArchived?: boolean | null;
  createdAt?: Date | string | null;
  lastPerformedAt?: Date | string | null;
};

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

/** 설정 스냅샷에서 활성 플랜 id를 읽는다(빈 문자열·비문자열은 미설정으로 본다). */
export function readActivePlanIdSetting(
  snapshot: Record<string, string | number | boolean | null> | null | undefined,
): string | null {
  const raw = snapshot?.[ACTIVE_PLAN_SETTING_KEY];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/**
 * 활성 플랜을 고른다.
 * 1) 설정된 활성 플랜(존재하고 보관되지 않았을 때)
 * 2) 가장 최근에 수행한 플랜
 * 3) 가장 최근에 만든 플랜
 */
export function resolveActivePlan<T extends ActivePlanCandidate>(
  plans: readonly T[],
  activePlanId: string | null | undefined,
): T | null {
  const selectable = plans.filter((plan) => plan.isArchived !== true);
  if (selectable.length === 0) return null;

  if (activePlanId) {
    const pinned = selectable.find((plan) => plan.id === activePlanId);
    if (pinned) return pinned;
  }

  const performed = selectable
    .filter((plan) => toTime(plan.lastPerformedAt) > 0)
    .sort((a, b) => toTime(b.lastPerformedAt) - toTime(a.lastPerformedAt));
  if (performed[0]) return performed[0];

  return (
    [...selectable].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))[0] ?? null
  );
}
