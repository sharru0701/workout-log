"use client";

import { ActionLinkRow } from "@/components/ui/page-layout";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

/**
 * NavRow Component
 * PERF: Replaced inline styles with Tailwind 4 classes.
 * Memoized to prevent unnecessary re-renders in list.
 */
export function NavRow({ item }: { item: NavItem }) {
  return (
    <ActionLinkRow
      href={item.href}
      icon={item.iconSymbol}
      eyebrow={item.subtitle}
      title={item.label}
      description={item.description}
    />
  );
}
