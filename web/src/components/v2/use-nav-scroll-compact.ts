"use client";

import { useEffect, useState } from "react";

// 방향을 확정하기 위해 한 방향으로 누적돼야 하는 최소 이동량(px).
// 작게 두면 반응이 빠르지만, 너무 작으면 미세 떨림에 흔들린다.
const DIR_THRESHOLD = 6;
// 이 스크롤 위치 이하(최상단 근처)에서는 항상 펼친 상태를 유지한다.
const TOP_GUARD = 24;

/**
 * 스크롤 방향에 따라 바텀 네비를 축소(compact)할지 반환한다.
 * - 아래로 스크롤(콘텐츠가 위로 올라감) → true  (축소)
 * - 위로 스크롤(콘텐츠가 아래로 내려옴) → false (복원)
 * - 최상단 근처 / prefers-reduced-motion 사용자 → 항상 false
 *
 * window 스크롤을 passive 리스너 + requestAnimationFrame으로 관찰하고,
 * 미세 이동은 누적 임계값으로 무시해 떨림을 막는다. 실제 크기 전환은
 * CSS(data-compact)가 담당하므로 여기서는 boolean 상태만 토글한다.
 * (인스타그램류 floating dock UX)
 */
export function useNavScrollCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let lastY = window.scrollY;
    let accum = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;

      if (y <= TOP_GUARD) {
        accum = 0;
        setCompact(false);
        return;
      }

      // 방향이 바뀌면 누적값을 리셋해 즉시 반대 방향으로 반응한다.
      if (delta !== 0 && delta > 0 !== accum > 0) accum = 0;
      accum += delta;

      if (accum > DIR_THRESHOLD) setCompact(true);
      else if (accum < -DIR_THRESHOLD) setCompact(false);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return compact;
}
