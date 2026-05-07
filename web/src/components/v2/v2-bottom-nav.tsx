"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { V2ActionDock, type V2ActionDockItem } from "./primitives";
import { V2MoreSheet } from "./v2-more-sheet";
import { V2PlanSheet } from "./v2-plan-sheet";
import { V2LibrarySheet } from "./v2-library-sheet";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SheetKey = "plan" | "library" | "more" | null;

export function V2BottomNav() {
  const pathname = usePathname() ?? "";
  const { copy, locale } = useLocale();
  const [sheet, setSheet] = useState<SheetKey>(null);

  const close = () => setSheet(null);

  const items: V2ActionDockItem[] = [
    {
      key: "start",
      icon: "play_arrow",
      label: copy.nav.log,
      href: "/workout/log",
      primary: true,
      active: isActive(pathname, "/workout/log"),
    },
    {
      key: "today",
      icon: "today",
      label: copy.nav.home,
      href: "/",
      active: isActive(pathname, "/"),
    },
    {
      key: "plan",
      icon: "event_note",
      label: locale === "ko" ? "계획" : "Plan",
      onClick: () => setSheet("plan"),
      active: sheet === "plan",
    },
    {
      key: "library",
      icon: "inventory_2",
      label: locale === "ko" ? "라이브러리" : "Library",
      onClick: () => setSheet("library"),
      active: sheet === "library",
    },
    {
      key: "more",
      icon: "more_horiz",
      label: locale === "ko" ? "더보기" : "More",
      onClick: () => setSheet("more"),
      active:
        sheet === "more" ||
        isActive(pathname, "/settings") ||
        isActive(pathname, "/stats") ||
        isActive(pathname, "/calendar"),
    },
  ];

  return (
    <>
      <V2ActionDock items={items} />
      <V2PlanSheet open={sheet === "plan"} onClose={close} />
      <V2LibrarySheet open={sheet === "library"} onClose={close} />
      <V2MoreSheet open={sheet === "more"} onClose={close} />
    </>
  );
}
