"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

function titleFromPathname(pathname: string) {
  if (pathname.startsWith("/workout/session/")) return "Session Detail";
  if (pathname.startsWith("/workout/today")) return "Workout Today";
  if (pathname.startsWith("/plans")) return "Plans";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/stats")) return "Stats";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/settings/data")) return "Data Export";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/offline")) return "Offline";
  if (pathname.startsWith("/error")) return "Error";
  return "Workout Log";
}

export function TopBackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const title = titleFromPathname(pathname);
  const isRoot = pathname === "/";

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  if (isRoot) {
    return (
      <div className="app-top-nav">
        <div className="app-top-nav-placeholder" aria-hidden="true" />
        <div className="app-top-nav-title">{title}</div>
        <div className="app-top-nav-placeholder" aria-hidden="true" />
        <div className="app-top-nav-fade" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="app-top-nav">
      <div className="app-top-back-wrap">
        <button type="button" className="haptic-tap app-top-back-button" onClick={handleBack} aria-label="Go back">
          <span className="app-top-back-icon" aria-hidden="true" />
        </button>
      </div>
      <div className="app-top-nav-title">{title}</div>
      <div className="app-top-nav-placeholder" aria-hidden="true" />
      <div className="app-top-nav-fade" aria-hidden="true" />
    </div>
  );
}
