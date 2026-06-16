"use client";

import { useEffect, useRef, useState } from "react";

// 당김 임계값/최대치/감쇠 — 손가락 이동 ≈ 거리/DAMPING 만큼 당겨야 트리거된다.
const THRESHOLD = 70;
const MAX_PULL = 112;
const DAMPING = 0.5;

/**
 * 설치된 PWA(standalone)에서 "당겨서 새로고침".
 *
 * - iOS 홈 화면 standalone에는 Safari 네이티브 당겨서 새로고침이 없고,
 *   앱이 `overscroll-behavior-y: contain`(base.css)으로 브라우저 기본 PTR도 꺼놨다.
 *   → 커스텀 제스처로 제공.
 * - 스크롤은 document(body)가 하므로 `window.scrollY === 0`(최상단)에서만 추적.
 * - 동작: 임계값 이상 당기고 놓으면 `location.reload()` (네이티브 Safari 새로고침과 동일,
 *   SW network-first가 fresh 제공). 커스텀 캐시 레이어에 전역 재검증 훅이 없어 reload가 가장 확실.
 * - 성능: 드래그 중 값은 React state 대신 CSS 변수(`--ptr-y`)로 DOM에 직접 반영(bottom-sheet 패턴).
 */
export function PullToRefresh() {
  const [active, setActive] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isStandalone || !("ontouchstart" in window)) return;
    setActive(true);

    let startY = 0;
    let tracking = false;
    let pull = 0;
    let refreshing = false;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const setVars = (y: number) => {
      const node = elRef.current;
      if (!node) return;
      node.style.setProperty("--ptr-y", `${y}px`);
      node.style.setProperty("--ptr-opacity", `${Math.min(1, y / THRESHOLD)}`);
    };

    const reset = () => {
      tracking = false;
      pull = 0;
      elRef.current?.classList.remove("is-dragging", "is-ready");
      setVars(0);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || !atTop()) {
        tracking = false;
        return;
      }
      startY = e.touches[0]?.clientY ?? 0;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - startY;
      if (dy <= 0 || !atTop()) {
        if (pull > 0) reset();
        else tracking = false;
        return;
      }
      // 최상단에서 아래로 당기는 중 — 기본 스크롤/바운스 차단
      e.preventDefault();
      pull = Math.min(MAX_PULL, dy * DAMPING);
      const node = elRef.current;
      if (node) {
        node.classList.add("is-dragging");
        node.classList.toggle("is-ready", pull >= THRESHOLD);
      }
      setVars(pull);
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      const node = elRef.current;
      if (pull >= THRESHOLD && node) {
        refreshing = true;
        node.classList.remove("is-dragging", "is-ready");
        node.classList.add("is-refreshing");
        const icon = node.querySelector(".ptr__icon");
        if (icon) icon.textContent = "progress_activity";
        setVars(THRESHOLD);
        // 스피너가 잠깐 보이도록 살짝 지연 후 새로고침
        window.setTimeout(() => window.location.reload(), 320);
      } else {
        reset();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!active) return null;

  return (
    <div ref={elRef} className="ptr" aria-hidden="true">
      <div className="ptr__badge">
        <span className="ptr__icon material-symbols-outlined">arrow_downward</span>
      </div>
    </div>
  );
}
