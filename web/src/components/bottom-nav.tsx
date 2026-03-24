"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11L12 4.5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V20h12V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordIcon() {
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

function CalendarIcon() {
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

function PlanIcon() {
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

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 2.5L3 8.5h18l-3-6H6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8.5v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12.5a3 3 0 0 0 6 0" strokeLinecap="round" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M7 20V10" strokeLinecap="round" />
      <path d="M12 20V5" strokeLinecap="round" />
      <path d="M17 20V13" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
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
  { href: "/workout/log", label: "기록", ariaLabel: "운동기록", Icon: RecordIcon },
  { href: "/calendar", label: "캘린더", ariaLabel: "캘린더", Icon: CalendarIcon },
  { href: "/plans/manage", label: "플랜", ariaLabel: "플랜 관리", Icon: PlanIcon },
  { href: "/program-store", label: "스토어", ariaLabel: "프로그램 스토어", Icon: StoreIcon },
  { href: "/stats", label: "통계", ariaLabel: "통계", Icon: StatsIcon },
  { href: "/settings", label: "설정", ariaLabel: "설정", Icon: SettingsIcon },
];

function tabIsActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TabItemProps = {
  tab: (typeof tabs)[number];
  isActive: boolean;
};

// PERF: pathname이 바뀌어도 비활성 탭은 재렌더링하지 않음
const TabItem = memo(function TabItem({ tab, isActive }: TabItemProps) {
  const Icon = tab.Icon;
  return (
    <Link
      href={tab.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={tab.ariaLabel}
      className={`bottom-tab-item${isActive ? " bottom-tab-item--active" : ""}`}
    >
      <span className="bottom-tab-pill">
        <span className="bottom-tab-icon" aria-hidden="true">
          <Icon />
        </span>
        <span className="bottom-tab-label">{tab.label}</span>
      </span>
    </Link>
  );
});

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="bottom-tab-bar" aria-label="메인 내비게이션">
      {tabs.map((tab) => (
        <TabItem
          key={tab.href}
          tab={tab}
          isActive={tabIsActive(pathname, tab.href)}
        />
      ))}
    </nav>
  );
}
