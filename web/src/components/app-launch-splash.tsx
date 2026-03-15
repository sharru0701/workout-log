"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const MIN_VISIBLE_MS = 560;
const EXIT_ANIMATION_MS = 220;

type SplashPhase = "visible" | "hiding" | "hidden";

function nowMs() {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

export function AppLaunchSplash() {
  const [phase, setPhase] = useState<SplashPhase>("visible");
  const startedAtRef = useRef<number>(nowMs());

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const closeSplash = () => {
      const elapsedMs = nowMs() - startedAtRef.current;
      const waitMs = Math.max(0, MIN_VISIBLE_MS - elapsedMs);

      closeTimer = setTimeout(() => {
        setPhase("hiding");
        hideTimer = setTimeout(() => setPhase("hidden"), EXIT_ANIMATION_MS);
      }, waitMs);
    };

    if (document.readyState === "complete") {
      closeSplash();
    } else {
      window.addEventListener("load", closeSplash, { once: true });
    }

    return () => {
      window.removeEventListener("load", closeSplash);
      if (closeTimer) clearTimeout(closeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="앱을 불러오는 중"
    >
      <div>
        <Image
          src="/icons/icon-192.png"
          width={76}
          height={76}
          alt=""
          priority
        />
        <p>Workout Log</p>
        <div aria-hidden="true">
          <span />
          <span>로딩 중</span>
        </div>
      </div>
    </div>
  );
}
