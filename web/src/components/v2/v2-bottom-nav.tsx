"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { V2ActionDock, type V2ActionDockItem } from "./primitives";
import { V2MoreSheet } from "./v2-more-sheet";
import { V2PlanSheet } from "./v2-plan-sheet";
import { V2LibrarySheet, type LibraryTab } from "./v2-library-sheet";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SheetKey = "plan" | "library" | "more" | null;

const PLAN_SHEET_ID = "v2-sheet-plan";
const LIBRARY_SHEET_ID = "v2-sheet-library";
const MORE_SHEET_ID = "v2-sheet-more";

function libraryTabForPath(pathname: string): LibraryTab {
  if (isActive(pathname, "/plans")) return "plans";
  if (isActive(pathname, "/program-store")) return "programs";
  return "exercises";
}

export function V2BottomNav() {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("exercises");

  // 메뉴 정책: 액션 독 버튼은 시트, URL 라우트는 화면.
  // 라우트 진입 시 시트를 자동으로 덮지 않아 레거시/신규 화면이 겹쳐 보이는 혼선을 막는다.
  const close = () => setSheet(null);

  const items: V2ActionDockItem[] = [
    {
      key: "start",
      icon: "play_arrow",
      label: locale === "ko" ? "시작" : "Start",
      href: "/workout/log",
      primary: true,
      active: isActive(pathname, "/workout/log"),
    },
    {
      key: "today",
      icon: "today",
      label: locale === "ko" ? "오늘" : "Today",
      href: "/",
      active: isActive(pathname, "/"),
    },
    {
      key: "plan",
      icon: "event_note",
      label: locale === "ko" ? "계획" : "Plan",
      onClick: () => setSheet(sheet === "plan" ? null : "plan"),
      active: sheet === "plan" || isActive(pathname, "/calendar"),
      expanded: sheet === "plan",
      controls: PLAN_SHEET_ID,
    },
    {
      key: "library",
      icon: "inventory_2",
      label: locale === "ko" ? "라이브러리" : "Library",
      onClick: () => {
        if (sheet === "library") setSheet(null);
        else {
          setLibraryTab(libraryTabForPath(pathname));
          setSheet("library");
        }
      },
      active:
        sheet === "library" ||
        isActive(pathname, "/exercises") ||
        isActive(pathname, "/plans") ||
        isActive(pathname, "/program-store"),
      expanded: sheet === "library",
      controls: LIBRARY_SHEET_ID,
    },
    {
      key: "more",
      icon: "more_horiz",
      label: locale === "ko" ? "더보기" : "More",
      onClick: () => setSheet(sheet === "more" ? null : "more"),
      active:
        sheet === "more" ||
        isActive(pathname, "/settings") ||
        isActive(pathname, "/stats"),
      expanded: sheet === "more",
      controls: MORE_SHEET_ID,
    },
  ];

  return (
    <>
      <V2ActionDock items={items} />
      <V2PlanSheet
        open={sheet === "plan"}
        onClose={close}
        controlsId={PLAN_SHEET_ID}
      />
      <V2LibrarySheet
        open={sheet === "library"}
        onClose={close}
        defaultTab={libraryTab}
        controlsId={LIBRARY_SHEET_ID}
      />
      <V2MoreSheet
        open={sheet === "more"}
        onClose={close}
        controlsId={MORE_SHEET_ID}
      />
    </>
  );
}
