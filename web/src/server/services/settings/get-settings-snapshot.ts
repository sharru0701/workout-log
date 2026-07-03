/**
 * 서버사이드 설정 스냅샷 로더 (쿠키 세션 래퍼).
 * 로직 본체는 @workout/core/services/settings/settings-snapshot — 여기서는 요청
 * 스코프(쿠키)에서 userId를 해석해 위임하고, 기존 importer 경로를 재export로 보존한다.
 */
import { requireAuthenticatedUserId } from "@/server/auth/user";
import {
  getSettingsSnapshotForUser,
  type SettingsSnapshot,
} from "@workout/core/services/settings/settings-snapshot";

export { getSettingsSnapshotForUser };
export type { SettingsSnapshot };

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const userId = await requireAuthenticatedUserId();
  return getSettingsSnapshotForUser(userId);
}
