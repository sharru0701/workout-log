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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11L12 4.5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V20h12V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 2.5L3 8.5h18l-3-6H6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8.5v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12.5a3 3 0 0 0 6 0" strokeLinecap="round" />
    </svg>
  );
}

function StatsIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M7 20V10" strokeLinecap="round" />
      <path d="M12 20V5" strokeLinecap="round" />
      <path d="M17 20V13" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: TabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
  const [isOpen, setIsOpen] = useState(false);
  const pathActiveTabIndex = tabs.findIndex((tab) => tabIsActive(pathname, tab.href));
  const [visualActiveTabIndex, setVisualActiveTabIndex] = useState(pathActiveTabIndex);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 현재 활성화된 탭 싱크
  useEffect(() => {
    setVisualActiveTabIndex(pathActiveTabIndex);
  }, [pathActiveTabIndex]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const onTabPress = (event: React.MouseEvent<HTMLAnchorElement>, tabIndex: number, href: string) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    setIsOpen(false); // 탭 클릭 시 메뉴 닫기
    const alreadyActive = tabIsActive(pathname, href);
    if (alreadyActive) {
      setVisualActiveTabIndex(tabIndex);
      return;
    }

    event.preventDefault();
    setVisualActiveTabIndex(tabIndex);
    
    // 부드러운 전환을 위한 딜레이 (애니메이션 동기화)
    setTimeout(() => {
      router.push(href);
    }, 150);
  };

  return (
    <div className="fab-container" ref={menuRef}>
      {/* 확장 메뉴 리스트 */}
      <div className={`fab-menu ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        {tabs.map((tab, tabIndex) => {
          const pathActive = tabIsActive(pathname, tab.href);
          const Icon = tab.Icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              aria-current={pathActive ? "page" : undefined}
              aria-label={tab.ariaLabel}
              title={tab.ariaLabel}
              onClick={(event) => onTabPress(event, tabIndex, tab.href)}
              className="fab-item"
            >
              <div className="fab-icon">
                <Icon />
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 메인 FAB 버튼 */}
      <button
        type="button"
        className={`fab-button ${isOpen ? "is-open" : ""}`}
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}
