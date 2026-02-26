"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPendingWorkoutLogCount, offlineQueueUpdateEventName } from "@/lib/offlineLogQueue";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/workout/today/log", label: "Today" },
  { href: "/plans/manage", label: "Plans" },
  { href: "/calendar", label: "Calendar" },
  { href: "/stats", label: "Stats" },
];

function tabIsActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/workout/today/log") {
    return pathname === href || pathname.startsWith("/workout/");
  }
  if (href === "/plans/manage") {
    return pathname === href || pathname.startsWith("/plans/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      setPendingSyncCount(getPendingWorkoutLogCount());
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener(offlineQueueUpdateEventName(), refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener(offlineQueueUpdateEventName(), refresh);
    };
  }, []);

  return (
    <nav className="app-bottom-nav" aria-label="Primary navigation">
      {tabs.map((tab) => {
        const active = tabIsActive(pathname, tab.href);
        const isTodayTab = tab.href === "/workout/today/log";
        const showPendingBadge = isTodayTab && pendingSyncCount > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-bottom-nav-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span>{tab.label}</span>
            {showPendingBadge && (
              <span className="app-bottom-nav-badge">{pendingSyncCount > 99 ? "99+" : pendingSyncCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
