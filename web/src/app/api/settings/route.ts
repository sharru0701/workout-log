import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { userSetting } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

type SettingValue = string | number | boolean | null;
type SettingsSnapshot = Record<string, SettingValue>;

type PatchRequestBody = {
  key?: unknown;
  value?: unknown;
  simulateFailure?: unknown;
};

const DEFAULT_SETTINGS: SettingsSnapshot = {
  "prefs.autoSync": true,
  "prefs.timezone": "UTC",
  "prefs.metricPresetDays": 90,
  "prefs.uxThreshold.saveFromGenerate": 0.65,
  "prefs.uxThreshold.saveSuccessFromClicks7d": 0.6,
  "prefs.uxThreshold.addAfterSheetOpen14d": 0.35,
};

declare global {
  var __workoutLogSettingsFallbackByUser: Record<string, SettingsSnapshot> | undefined;
}

function getFallbackStoreForUser(userId: string) {
  if (!globalThis.__workoutLogSettingsFallbackByUser) {
    globalThis.__workoutLogSettingsFallbackByUser = {};
  }
  if (!globalThis.__workoutLogSettingsFallbackByUser[userId]) {
    globalThis.__workoutLogSettingsFallbackByUser[userId] = { ...DEFAULT_SETTINGS };
  }
  return globalThis.__workoutLogSettingsFallbackByUser[userId];
}

function isSettingValue(value: unknown): value is SettingValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function toSafeSettingValue(value: unknown): SettingValue | undefined {
  if (isSettingValue(value)) return value;
  return undefined;
}

function mergeWithDefaults(snapshot: SettingsSnapshot): SettingsSnapshot {
  return {
    ...DEFAULT_SETTINGS,
    ...snapshot,
  };
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const asRecord = error as Record<string, unknown>;
  if (asRecord.code === "42P01") return true;
  const cause = asRecord.cause;
  if (!cause || typeof cause !== "object") return false;
  return (cause as Record<string, unknown>).code === "42P01";
}

async function readSettingsFromDb(userId: string): Promise<SettingsSnapshot> {
  const rows = await db
    .select({
      key: userSetting.key,
      value: userSetting.value,
    })
    .from(userSetting)
    .where(eq(userSetting.userId, userId));

  const snapshot: SettingsSnapshot = {};
  for (const row of rows) {
    const value = toSafeSettingValue(row.value);
    if (value === undefined) continue;
    snapshot[row.key] = value;
  }
  return snapshot;
}

async function GETImpl() {
  const userId = getAuthenticatedUserId();
  try {
    const settings = mergeWithDefaults(await readSettingsFromDb(userId));
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    if (isMissingTableError(error)) {
      const settings = { ...getFallbackStoreForUser(userId) };
      return NextResponse.json({ settings });
    }
    logError("api.handler_error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function PATCHImpl(request: Request) {
  const userId = getAuthenticatedUserId();
  try {
    const body = (await request.json().catch(() => ({}))) as PatchRequestBody;
    const key = typeof body.key === "string" ? body.key.trim() : "";

    if (!key) {
      return NextResponse.json({ error: "설정 키가 비어 있습니다." }, { status: 400 });
    }

    if (!Object.hasOwn(body, "value") || !isSettingValue(body.value)) {
      return NextResponse.json({ error: "설정 값 형식이 잘못되었습니다." }, { status: 400 });
    }

    if (body.simulateFailure === true) {
      return NextResponse.json({ error: "테스트용 저장 실패가 강제되었습니다." }, { status: 503 });
    }

    const nextValue = body.value;

    try {
      await db
        .insert(userSetting)
        .values({
          userId,
          key,
          value: nextValue,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userSetting.userId, userSetting.key],
          set: {
            value: nextValue,
            updatedAt: new Date(),
          },
        });

      const settings = mergeWithDefaults(await readSettingsFromDb(userId));
      return NextResponse.json({
        ok: true,
        setting: { key, value: settings[key] },
        settings,
      });
    } catch (error: unknown) {
      if (!isMissingTableError(error)) throw error;
      const snapshot = getFallbackStoreForUser(userId);
      snapshot[key] = nextValue;
      return NextResponse.json({
        ok: true,
        setting: { key, value: snapshot[key] },
        settings: { ...snapshot },
      });
    }
  } catch (error: unknown) {
    logError("api.handler_error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging(GETImpl);
export const PATCH = withApiLogging(PATCHImpl);
