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
      className={`app-launch-splash${phase === "hiding" ? " is-fade-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="앱을 불러오는 중"
    >
      <div className="app-launch-splash-card">
        <Image
          className="app-launch-splash-logo"
          src="/icons/icon-192.png"
          width={76}
          height={76}
          alt=""
          priority
        />
        <p className="app-launch-splash-brand">Workout Log</p>
        <div className="app-launch-splash-progress" aria-hidden="true">
          <span className="app-launch-splash-spinner" />
          <span className="app-launch-splash-label">로딩 중</span>
        </div>
      </div>
    </div>
  );
}
