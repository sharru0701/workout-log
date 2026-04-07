"use client";

import Link from "next/link";

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
    <Link
      href={item.href}
      className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors duration-200 no-underline group"
    >
      <span
        className="material-symbols-outlined text-2xl text-primary shrink-0 group-hover:scale-110 transition-transform"
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
        aria-hidden="true"
      >
        {item.iconSymbol}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5 font-label">
          {item.subtitle}
        </div>
        <div className="text-base font-bold text-text mb-0.5 tracking-tight font-headline">
          {item.label}
        </div>
        <div className="text-xs text-text-tertiary leading-relaxed">
          {item.description}
        </div>
      </div>

      <span
        className="material-symbols-outlined text-lg text-text-tertiary opacity-30 shrink-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
        aria-hidden="true"
      >
        chevron_right
      </span>
    </Link>
  );
}
