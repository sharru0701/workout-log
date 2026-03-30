"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

function tabIsActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TabItemProps = {
  href: string;
  label: string;
  icon: string;
  isActive: boolean;
};

const TabItem = memo(function TabItem({ href, label, icon, isActive }: TabItemProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
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
          {icon}
        </span>
        <span className="bottom-tab-label">{label}</span>
      </span>
    </Link>
  );
});

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const { copy } = useLocale();
  const tabs = [
    { href: "/", label: copy.nav.home, icon: "home" },
    { href: "/workout/log", label: copy.nav.log, icon: "add_box" },
    { href: "/calendar", label: copy.nav.calendar, icon: "calendar_today" },
    { href: "/stats", label: copy.nav.stats, icon: "insights" },
    { href: "/settings", label: copy.nav.settings, icon: "settings" },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label={copy.nav.mainNavigation}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.href}
          href={tab.href}
          label={tab.label}
          icon={tab.icon}
          isActive={tabIsActive(pathname, tab.href)}
        />
      ))}
    </nav>
  );
}
