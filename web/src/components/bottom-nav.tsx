"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

const tabs = [
  { href: "/", label: "홈" },
  { href: "/workout-record", label: "운동기록" },
  { href: "/program-store", label: "프로그램 스토어" },
  { href: "/stats-1rm", label: "1RM 통계" },
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
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(element) => {
              tabRefs.current[tabIndex] = element;
            }}
            className={`app-bottom-nav-tab${visualActive ? " is-active" : ""}`}
            aria-current={pathActive ? "page" : undefined}
            onClick={(event) => onTabPress(event, tabIndex, tab.href)}
          >
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
