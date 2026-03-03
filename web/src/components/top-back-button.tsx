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
          aria-current={isSettingsRoute ? "page" : undefined}
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
