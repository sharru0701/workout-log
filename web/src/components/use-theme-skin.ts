"use client";

import { useSyncExternalStore } from "react";
import {
  getThemeSkinSnapshot,
  subscribeThemeSkin,
} from "@/lib/settings/theme-skin-store";
import type { ThemeSkin } from "@/lib/settings/workout-preferences";

// 반응형 스킨 훅 — terminal/paper. SSR/첫 클라 렌더는 항상 "paper"(getServerSnapshot)
// → 하이드레이션 불일치 0. mount 후 store가 flip되면 re-render.
const getServerSnapshot = (): ThemeSkin => "paper";

export function useThemeSkin(): ThemeSkin {
  return useSyncExternalStore(
    subscribeThemeSkin,
    getThemeSkinSnapshot,
    getServerSnapshot,
  );
}
