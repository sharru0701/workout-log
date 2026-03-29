"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", ariaLabel: "홈", icon: "home" },
  { href: "/workout/log", label: "Log", ariaLabel: "운동기록", icon: "add_box" },
  { href: "/calendar", label: "Calendar", ariaLabel: "캘린더", icon: "calendar_today" },
  { href: "/stats", label: "Stats", ariaLabel: "통계", icon: "insights" },
  { href: "/settings", label: "Settings", ariaLabel: "설정", icon: "settings" },
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
  return (
    <Link
      href={tab.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={tab.ariaLabel}
      className={`bottom-tab-item${isActive ? " bottom-tab-item--active" : ""}`}
    >
      <span className="bottom-tab-pill">
        <span
          className="material-symbols-outlined bottom-tab-icon"
          aria-hidden="true"
          style={
            isActive
              ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }
              : { fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
          }
        >
          {tab.icon}
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
