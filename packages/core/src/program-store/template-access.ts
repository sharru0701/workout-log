/**
 * 프로그램 템플릿 가시성 규칙 — 스토어 목록 쿼리와 "이 플랜의 기반 프로그램을 아직
 * 볼 수 있는가" 판정이 같은 규칙을 쓰도록 한 곳에 둔다.
 *
 * 규칙이 갈라지면 플랜은 멀쩡히 돌아가는데 그 원본 프로그램만 스토어에서 사라진
 * 상태를 사용자가 진단할 수 없다(실제로 인증 도입 전 fallback userId로 만들어진
 * PRIVATE 템플릿이 계정 전환 후 주인을 잃어 이 상황이 발생했다).
 */

export type ProgramTemplateAccessInput = {
  visibility?: string | null;
  ownerUserId?: string | null;
} | null | undefined;

/** 스토어 목록 쿼리와 동일: PUBLIC이거나, 내가 소유한 PRIVATE. */
export function isProgramTemplateAccessible(
  template: ProgramTemplateAccessInput,
  userId: string | null | undefined,
): boolean {
  if (!template) return false;
  if (template.visibility === "PUBLIC") return true;
  if (template.visibility !== "PRIVATE") return false;
  const owner = template.ownerUserId?.trim();
  const viewer = userId?.trim();
  return Boolean(owner && viewer && owner === viewer);
}
