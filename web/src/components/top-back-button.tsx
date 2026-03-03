"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function titleFromPathname(pathname: string) {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/workout-record/add-exercise")) return "Add Exercise";
  if (pathname.startsWith("/workout-record/exercise-catalog")) return "Exercise Catalog";
  if (pathname.startsWith("/workout-record")) return "Workout Record";
  if (pathname.startsWith("/program-store/create")) return "Create Program";
  if (pathname.startsWith("/program-store/customize")) return "Customize Program";
  if (pathname.startsWith("/program-store/detail")) return "Program Detail";
  if (pathname.startsWith("/program-store")) return "Program Store";
  if (pathname.startsWith("/stats-1rm")) return "1RM Stats";
  if (pathname.startsWith("/settings/theme")) return "Theme";
  if (pathname.startsWith("/settings/minimum-plate")) return "Minimum Plate";
  if (pathname.startsWith("/settings/bodyweight")) return "Bodyweight";
  if (pathname.startsWith("/settings/data-export")) return "Data Export";
  if (pathname.startsWith("/settings/offline-help")) return "Offline Help";
  if (pathname.startsWith("/settings/about")) return "App Info";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Workout Log";
}

export function TopBackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const title = titleFromPathname(pathname);
  const topNavClassName = "app-top-nav app-top-nav--ios";
  const isSettingsRoute = pathname.startsWith("/settings");

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  return (
    <div className={topNavClassName}>
      <div className="app-top-back-wrap">
        <button type="button" className="haptic-tap app-top-back-button" onClick={handleBack} aria-label="Go back">
          <span className="app-top-back-icon" aria-hidden="true" />
        </button>
      </div>
      <div className="app-top-nav-title">{title}</div>
      <div className="app-top-settings-wrap">
        <Link
          href="/settings"
          className={`haptic-tap app-top-settings-button${isSettingsRoute ? " is-active" : ""}`}
          aria-label="Settings"
          aria-current={isSettingsRoute ? "page" : undefined}
        >
          <span className="app-top-settings-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}
