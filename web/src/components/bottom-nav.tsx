"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="app-bottom-nav app-bottom-nav--skeleton" aria-label="Floating tab navigation">
      {tabs.map((tab) => {
        const active = tabIsActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-bottom-nav-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
