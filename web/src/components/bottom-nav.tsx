"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 11L12 4.5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V20h12V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11L12 4.5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V20h12V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecordIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="3" width="16" height="18" rx="2" strokeLinejoin="round" />
      <path d="M8 8h8" strokeLinecap="round" />
      <path d="M8 12h5" strokeLinecap="round" />
      <path d="M8 16h3" strokeLinecap="round" />
      <circle cx="17" cy="16" r="3" fill="currentColor" stroke="none" />
      <path d="M16 16l0.7 0.7L18 15.3" stroke="var(--color-cta-on)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" strokeLinejoin="round" />
      <path d="M8 8h8" strokeLinecap="round" />
      <path d="M8 12h5" strokeLinecap="round" />
      <path d="M8 16h3" strokeLinecap="round" />
      <circle cx="17" cy="16" r="3" />
      <path d="M16 16l0.7 0.7L18 15.3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeLinecap="round" />
      <path d="M16 2.5v3" strokeLinecap="round" />
      <rect x="7" y="12" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="13" y="12" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeLinecap="round" />
      <path d="M16 2.5v3" strokeLinecap="round" />
      <rect x="7" y="12" width="3.5" height="3.5" rx="0.5" />
      <rect x="13" y="12" width="3.5" height="3.5" rx="0.5" />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 20h18" strokeLinecap="round" />
      <rect x="5.5" y="12" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="10.5" y="7" width="3" height="13" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="15.5" y="4" width="3" height="16" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M7 20V12" strokeLinecap="round" />
      <path d="M12 20V7" strokeLinecap="round" />
      <path d="M17 20V4" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const tabs = [
  { href: "/", label: "Home", ariaLabel: "홈", Icon: HomeIcon },
  { href: "/workout/log", label: "Record", ariaLabel: "운동기록", Icon: RecordIcon },
  { href: "/calendar", label: "Calendar", ariaLabel: "캘린더", Icon: CalendarIcon },
  { href: "/stats", label: "Stats", ariaLabel: "통계", Icon: StatsIcon },
  { href: "/settings", label: "Settings", ariaLabel: "설정", Icon: SettingsIcon },
];

function tabIsActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TabItemProps = {
  tab: (typeof tabs)[number];
  isActive: boolean;
};

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
          <Icon active={isActive} />
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
