"use client";

import type { ReactNode } from "react";
import { useNavScrollCompact } from "@/components/v2/use-nav-scroll-compact";

/**
 * 하단 sticky 액션바(저장 버튼 등). 바텀 네비(V2ActionDock)와 동일한 스크롤
 * 신호(useNavScrollCompact)를 구독해, 네비가 compact로 축소될 때 저장 버튼도
 * 함께 내려온다. 연동하지 않으면 네비만 낮아지며 버튼과의 간격이 벌어져
 * 버튼이 떠 보인다. 실제 위치 전환은 CSS(.app-sticky-action[data-compact]).
 */
export function StickyActionBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const compact = useNavScrollCompact();
  return (
    <div
      className={`app-sticky-action${className ? ` ${className}` : ""}`}
      data-compact={compact ? "" : undefined}
    >
      {children}
    </div>
  );
}
