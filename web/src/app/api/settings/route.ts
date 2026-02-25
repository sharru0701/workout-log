import { NextResponse } from "next/server";

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
};

declare global {
  // eslint-disable-next-line no-var
  var __workoutLogSettingsSnapshot: SettingsSnapshot | undefined;
}

function getSnapshotStore() {
  if (!globalThis.__workoutLogSettingsSnapshot) {
    globalThis.__workoutLogSettingsSnapshot = { ...DEFAULT_SETTINGS };
  }
  return globalThis.__workoutLogSettingsSnapshot;
}

function isSettingValue(value: unknown): value is SettingValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

export async function GET() {
  const settings = { ...getSnapshotStore() };
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
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

  const snapshot = getSnapshotStore();
  snapshot[key] = body.value;

  return NextResponse.json({
    ok: true,
    setting: { key, value: snapshot[key] },
    settings: { ...snapshot },
  });
}

