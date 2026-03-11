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
      <path d="M4 11L12 4.5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V20h12V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M6.5 9.5v5" strokeLinecap="round" />
      <path d="M9 7.5v9" strokeLinecap="round" />
      <path d="M15 7.5v9" strokeLinecap="round" />
      <path d="M17.5 9.5v5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeLinecap="round" />
      <path d="M16 2.5v3" strokeLinecap="round" />
      <path d="M8 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.5h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeLinecap="round" />
      <path d="M16 2.5v3" strokeLinecap="round" />
      <path d="M7.5 13.5h4" strokeLinecap="round" />
      <path d="M7.5 17.5h4" strokeLinecap="round" />
      <path d="M14.5 12.5l1 1 2.5-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 16.5l1 1 2.5-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StoreIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 2.5L3 8.5h18l-3-6H6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8.5v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12.5a3 3 0 0 0 6 0" strokeLinecap="round" />
    </svg>
  );
}

function StatsIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M7 20V10" strokeLinecap="round" />
      <path d="M12 20V5" strokeLinecap="round" />
      <path d="M17 20V13" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 6h4" strokeLinecap="round" />
      <circle cx="10" cy="6" r="2" />
      <path d="M12 6h8" strokeLinecap="round" />
      <path d="M4 12h10" strokeLinecap="round" />
      <circle cx="16" cy="12" r="2" />
      <path d="M18 12h2" strokeLinecap="round" />
      <path d="M4 18h2" strokeLinecap="round" />
      <circle cx="8" cy="18" r="2" />
      <path d="M10 18h10" strokeLinecap="round" />
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
  { href: "/settings", label: "설정", ariaLabel: "설정", Icon: SettingsIcon },
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
            prefetch={false}
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
