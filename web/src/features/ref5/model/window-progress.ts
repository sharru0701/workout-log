import type { Ref5Status } from "@workout/core/program-engine/ref5-status";

export const REF5_WINDOW_KEYS = ["SQ", "BP", "PULL", "DL", "OHP"] as const;

export type Ref5WindowKey = (typeof REF5_WINDOW_KEYS)[number];

const WINDOW_LABELS: Record<"ko" | "en", Record<Ref5WindowKey, string>> = {
  ko: {
    SQ: "SQ 하드",
    BP: "BP 집중",
    PULL: "PULL 집중",
    DL: "DL",
    OHP: "OHP",
  },
  en: {
    SQ: "SQ hard",
    BP: "BP focus",
    PULL: "PULL focus",
    DL: "DL",
    OHP: "OHP",
  },
};

const WINDOW_DESCRIPTIONS: Record<"ko" | "en", string> = {
  ko: "하드 = INVALID가 아닌 SQ H3(3×3)·H2(3×2), 집중 = 당일 우선 종목으로 배정된 INVALID가 아닌 BP·PULL 3×3입니다. 볼륨 세트는 횟수에서 제외하지만 볼륨 FAIL은 최종 판정에 반영합니다. 기준 횟수에서 자동 판정 후 0부터 다시 집계합니다.",
  en: "Hard means a non-INVALID SQ H3 (3×3) or H2 (3×2); focus means a non-INVALID 3×3 BP/PULL assigned as the session priority. Volume sets do not advance the count, but volume FAILs affect the final judgment. Each window resets after automatic judgment.",
};

export function getRef5WindowProgressDescription(locale: "ko" | "en") {
  return WINDOW_DESCRIPTIONS[locale];
}

export function buildRef5WindowProgressRows(
  status: Ref5Status,
  locale: "ko" | "en",
) {
  return REF5_WINDOW_KEYS.map((key) => {
    const window = status.windows[key];
    return {
      key,
      label: WINDOW_LABELS[locale][key],
      current: window.current,
      threshold: window.threshold,
      completed: window.completed,
      ratio: Math.min(1, window.current / Math.max(1, window.threshold)),
    };
  });
}
