/**
 * 서버사이드 설정 스냅샷 로더
 * 클라이언트 API 호출 없이 DB에서 직접 설정을 읽어 SSR에 사용합니다.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { userSetting } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import type { SettingValue } from "@/lib/settings/update-setting";

export type SettingsSnapshot = Record<string, SettingValue>;

const DEFAULT_SETTINGS: SettingsSnapshot = {
  "prefs.locale": "ko",
  "prefs.theme.mode": "SYSTEM",
  "prefs.minimumPlate.defaultKg": 2.5,
  "prefs.minimumPlate.rulesJson": "[]",
  "prefs.bodyweight.kg": 70,
  "prefs.autoSync": true,
  "prefs.timezone": "UTC",
  "prefs.metricPresetDays": 90,
  "prefs.uxThreshold.saveFromGenerate": 0.65,
  "prefs.uxThreshold.saveSuccessFromClicks7d": 0.6,
  "prefs.uxThreshold.addAfterSheetOpen14d": 0.35,
};

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const userId = getAuthenticatedUserId();
  const rows = await db
    .select({ key: userSetting.key, value: userSetting.value })
    .from(userSetting)
    .where(eq(userSetting.userId, userId));

  const snapshot: SettingsSnapshot = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const value = row.value;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      snapshot[row.key] = value;
    }
  }
  return snapshot;
}
