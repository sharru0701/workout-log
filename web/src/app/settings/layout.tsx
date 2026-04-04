"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SettingsModalHeaderActionProvider,
  useSettingsModalHeaderActionState,
} from "@/components/settings/settings-modal-header-action";
import { useLocale } from "@/components/locale-provider";
import { SettingsHomeContent } from "@/components/settings/settings-home-content";
import { BottomSheet } from "@/components/ui/bottom-sheet";

function modalTitleFromPathname(
  pathname: string,
  titles: ReturnType<typeof useLocale>["copy"]["settings"]["modalTitles"],
  detailTitle: string,
) {
  if (pathname.startsWith("/settings/language")) return titles.language;
  if (pathname.startsWith("/settings/theme")) return titles.theme;
  if (pathname.startsWith("/settings/minimum-plate")) return titles.minimumPlate;
  if (pathname.startsWith("/settings/bodyweight")) return titles.bodyweight;
  if (pathname.startsWith("/settings/exercise-management")) return titles.exerciseManagement;
  if (pathname.startsWith("/settings/data-export")) return titles.dataExport;
  if (pathname.startsWith("/settings/data")) return titles.data;
  if (pathname.startsWith("/settings/about")) return titles.about;
  if (pathname.startsWith("/settings/save-policy")) return titles.savePolicy;
  if (pathname.startsWith("/settings/selection-template")) return titles.selectionTemplate;
  if (pathname.startsWith("/settings/ux-thresholds")) return titles.uxThresholds;
  return detailTitle;
}

function modalDescriptionFromPathname(
  pathname: string,
  descriptions: ReturnType<typeof useLocale>["copy"]["settings"]["modalDescriptions"],
) {
  if (pathname.startsWith("/settings/language")) {
    return descriptions.language;
  }
  if (pathname.startsWith("/settings/data")) {
    return descriptions.data;
  }
  if (pathname.startsWith("/settings/exercise-management")) {
    return descriptions.exerciseManagement;
  }
  return descriptions.default;
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/settings";
  const router = useRouter();
  const isRoot = pathname === "/settings";
  const closeTimerRef = useRef<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);

  useEffect(() => {
    if (isRoot) return;
    setSheetOpen(true);
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, [isRoot, pathname]);

  useEffect(
    () => () => {
      if (closeTimerRef.current === null) return;
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    setSheetOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      router.push("/settings");
    }, 400);
  }, [router]);

  if (isRoot) {
    return <>{children}</>;
  }

  return (
    <SettingsModalHeaderActionProvider>
      <SettingsChildModal pathname={pathname} sheetOpen={sheetOpen} onClose={handleClose}>
        {children}
      </SettingsChildModal>
    </SettingsModalHeaderActionProvider>
  );
}

function SettingsChildModal({
  pathname,
  sheetOpen,
  onClose,
  children,
}: {
  pathname: string;
  sheetOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const headerAction = useSettingsModalHeaderActionState();
  const { copy } = useLocale();
  const isExerciseManagement = pathname.startsWith("/settings/exercise-management");
  const panelClassName = `settings-child-modal-panel${isExerciseManagement ? " settings-child-modal-panel--fixed-height" : ""}`;

  return (
    <>
      {/* ── Root content rendered behind the sheet ── */}
      <SettingsHomeContent />

      <BottomSheet
        open={sheetOpen}
        onClose={onClose}
        title={modalTitleFromPathname(pathname, copy.settings.modalTitles, copy.settings.detailTitle)}
        description={modalDescriptionFromPathname(pathname, copy.settings.modalDescriptions)}
        closeLabel={copy.settings.close}
        panelClassName={panelClassName}
        primaryAction={headerAction}
      >
        <div>{children}</div>
      </BottomSheet>
    </>
  );
}
