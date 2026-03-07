"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

type TabIconProps = {
  className?: string;
};

function HomeIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3.75 10.5L12 4l8.25 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 9.75v9h10.5v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3.75 12h16.5" strokeLinecap="round" />
      <path d="M6 9.75v4.5" strokeLinecap="round" />
      <path d="M8.25 8.25v7.5" strokeLinecap="round" />
      <path d="M15.75 8.25v7.5" strokeLinecap="round" />
      <path d="M18 9.75v4.5" strokeLinecap="round" />
    </svg>
  );
}

function PlanIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7.5 3.75v3" strokeLinecap="round" />
      <path d="M16.5 3.75v3" strokeLinecap="round" />
      <path d="M4.5 9h15" strokeLinecap="round" />
      <path d="M8.25 12.75h3" strokeLinecap="round" />
      <path d="M8.25 16.5h3" strokeLinecap="round" />
      <path d="M15 12.15l.9.9 1.85-2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 15.9l.9.9 1.85-2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 5.25h10.5A2.25 2.25 0 0 1 19.5 7.5v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V7.5a2.25 2.25 0 0 1 2.25-2.25Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StoreIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4.5 9.75h15" strokeLinecap="round" />
      <path d="M6.75 9.75v8.25h10.5V9.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.25 9.75 6.75 5.25h10.5l1.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 12.75h4.5" strokeLinecap="round" />
    </svg>
  );
}

function StatsIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5.25 18.75h13.5" strokeLinecap="round" />
      <path d="M7.5 16.5v-4.5" strokeLinecap="round" />
      <path d="M12 16.5v-8.25" strokeLinecap="round" />
      <path d="M16.5 16.5V10.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3.75" y="4.5" width="16.5" height="16.5" rx="2.25" strokeLinejoin="round" />
      <path d="M3.75 9.75h16.5" strokeLinecap="round" />
      <path d="M8.25 3.75v1.5" strokeLinecap="round" />
      <path d="M15.75 3.75v1.5" strokeLinecap="round" />
      <path d="M8.25 13.5h.008" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13.5h.008" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.75 13.5h.008" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.25 17.25h.008" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.25h.008" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const tabs = [
  { href: "/", label: "홈", ariaLabel: "홈", Icon: HomeIcon },
  { href: "/workout-record", label: "기록", ariaLabel: "운동기록", Icon: RecordIcon },
  { href: "/calendar", label: "캘린더", ariaLabel: "캘린더", Icon: CalendarIcon },
  { href: "/plans/manage", label: "플랜", ariaLabel: "플랜 관리", Icon: PlanIcon },
  { href: "/program-store", label: "스토어", ariaLabel: "프로그램 스토어", Icon: StoreIcon },
  { href: "/stats-1rm", label: "1RM", ariaLabel: "1RM 통계", Icon: StatsIcon },
];

function tabIsActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TabRouteDirection = "forward" | "backward";

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const pathActiveTabIndex = tabs.findIndex((tab) => tabIsActive(pathname, tab.href));
  const [visualActiveTabIndex, setVisualActiveTabIndex] = useState(pathActiveTabIndex);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false });
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const pendingNavTimerRef = useRef<number | null>(null);
  const clearDirectionTimerRef = useRef<number | null>(null);
  const pendingDirectionRef = useRef<TabRouteDirection | null>(null);

  const syncIndicator = useCallback(
    (index: number) => {
      const target = index >= 0 ? tabRefs.current[index] : null;
      if (!target) {
        setIndicator((prev) => ({ ...prev, visible: false }));
        return;
      }
      setIndicator({
        x: target.offsetLeft,
        width: target.offsetWidth,
        visible: true,
      });
    },
    [setIndicator],
  );

  useEffect(() => {
    setVisualActiveTabIndex(pathActiveTabIndex);
  }, [pathActiveTabIndex]);

  useEffect(
    () => () => {
      if (pendingNavTimerRef.current !== null) {
        window.clearTimeout(pendingNavTimerRef.current);
        pendingNavTimerRef.current = null;
      }
      if (clearDirectionTimerRef.current !== null) {
        window.clearTimeout(clearDirectionTimerRef.current);
        clearDirectionTimerRef.current = null;
      }
      pendingDirectionRef.current = null;
      document.documentElement.removeAttribute("data-tab-route-pending-direction");
      document.documentElement.removeAttribute("data-tab-route-direction");
    },
    [],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const pendingDirection =
      pendingDirectionRef.current ??
      ((root.getAttribute("data-tab-route-pending-direction") as TabRouteDirection | null) ?? null);
    if (!pendingDirection) return;

    pendingDirectionRef.current = null;
    root.removeAttribute("data-tab-route-pending-direction");

    if (clearDirectionTimerRef.current !== null) {
      window.clearTimeout(clearDirectionTimerRef.current);
      clearDirectionTimerRef.current = null;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      root.removeAttribute("data-tab-route-direction");
      return;
    }

    root.setAttribute("data-tab-route-direction", pendingDirection);
    clearDirectionTimerRef.current = window.setTimeout(() => {
      clearDirectionTimerRef.current = null;
      root.removeAttribute("data-tab-route-direction");
    }, 320);
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncIndicator(visualActiveTabIndex);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [syncIndicator, visualActiveTabIndex]);

  useEffect(() => {
    const onResize = () => {
      syncIndicator(visualActiveTabIndex);
    };
    window.addEventListener("resize", onResize);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncIndicator(visualActiveTabIndex);
          });

    if (navRef.current && resizeObserver) {
      resizeObserver.observe(navRef.current);
      tabRefs.current.forEach((tab) => {
        if (tab) resizeObserver.observe(tab);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, [syncIndicator, visualActiveTabIndex]);

  const navStyle = {
    "--bottom-nav-tabs-count": tabs.length,
    "--bottom-nav-indicator-x": `${indicator.x}px`,
    "--bottom-nav-indicator-width": `${indicator.width}px`,
    "--bottom-nav-indicator-opacity": indicator.visible ? 0.98 : 0,
  } as CSSProperties;

  const onTabPress = (event: MouseEvent<HTMLAnchorElement>, tabIndex: number, href: string) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const alreadyActive = tabIsActive(pathname, href);
    if (alreadyActive) {
      setVisualActiveTabIndex(tabIndex);
      return;
    }

    event.preventDefault();
    const direction: TabRouteDirection = tabIndex > visualActiveTabIndex ? "forward" : "backward";
    pendingDirectionRef.current = direction;
    document.documentElement.setAttribute("data-tab-route-pending-direction", direction);
    document.documentElement.removeAttribute("data-tab-route-direction");

    setVisualActiveTabIndex(tabIndex);
    if (pendingNavTimerRef.current !== null) {
      window.clearTimeout(pendingNavTimerRef.current);
      pendingNavTimerRef.current = null;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const navDelayMs = reducedMotion ? 0 : 220;
    pendingNavTimerRef.current = window.setTimeout(() => {
      pendingNavTimerRef.current = null;
      router.push(href);
    }, navDelayMs);
  };

  return (
    <nav
      ref={navRef}
      className="app-bottom-nav app-bottom-nav--skeleton"
      aria-label="Floating tab navigation"
      style={navStyle}
    >
      {tabs.map((tab, tabIndex) => {
        const pathActive = tabIsActive(pathname, tab.href);
        const visualActive = tabIndex === visualActiveTabIndex;
        const Icon = tab.Icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(element) => {
              tabRefs.current[tabIndex] = element;
            }}
            className={`app-bottom-nav-tab${visualActive ? " is-active" : ""}`}
            aria-current={pathActive ? "page" : undefined}
            aria-label={tab.ariaLabel}
            title={tab.ariaLabel}
            onClick={(event) => onTabPress(event, tabIndex, tab.href)}
          >
            <Icon className="app-bottom-nav-icon" />
            <span className="app-bottom-nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
