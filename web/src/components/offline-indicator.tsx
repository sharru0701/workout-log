"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

/**
 * Shows a subtle top bar when the user goes offline, and briefly when
 * reconnected. Positioned above safe-area-inset-top so it's always visible
 * even in standalone / notch mode.
 */
export function OfflineIndicator() {
  const { locale } = useLocale();
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Sync with actual network state after hydration.
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      clearTimeout(reconnectedTimer.current);
      reconnectedTimer.current = setTimeout(() => setShowReconnected(false), 2500);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
      clearTimeout(reconnectedTimer.current);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(reconnectedTimer.current);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`offline-indicator ${
        online ? "offline-indicator--online" : "offline-indicator--offline"
      }`}
    >
      {online
        ? (locale === "ko" ? "다시 연결되었습니다" : "Back online")
        : (locale === "ko" ? "오프라인 — 인터넷 연결을 확인해 주세요" : "Offline. Check your internet connection.")}
    </div>
  );
}
