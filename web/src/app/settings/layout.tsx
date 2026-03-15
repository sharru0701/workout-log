"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SettingsModalHeaderActionProvider,
  useSettingsModalHeaderActionState,
} from "@/components/settings/settings-modal-header-action";
import { SettingsHomeContent } from "@/components/settings/settings-home-content";
import { BottomSheet } from "@/components/ui/bottom-sheet";

function modalTitleFromPathname(pathname: string) {
  if (pathname.startsWith("/settings/theme")) return "테마 설정";
  if (pathname.startsWith("/settings/minimum-plate")) return "최소 원판 무게";
  if (pathname.startsWith("/settings/bodyweight")) return "몸무게 입력";
  if (pathname.startsWith("/settings/exercise-management")) return "운동종목 관리";
  if (pathname.startsWith("/settings/data-export")) return "데이터 Export";
  if (pathname.startsWith("/settings/data")) return "데이터 관리";
  if (pathname.startsWith("/settings/about")) return "앱 정보";
  if (pathname.startsWith("/settings/save-policy")) return "저장 정책";
  if (pathname.startsWith("/settings/selection-template")) return "선택 템플릿";
  if (pathname.startsWith("/settings/ux-thresholds")) return "UX 기준치";
  return "설정 상세";
}

function modalDescriptionFromPathname(pathname: string) {
  if (pathname.startsWith("/settings/data")) {
    return "데이터 Export와 앱 전체 초기화 작업을 관리합니다.";
  }
  if (pathname.startsWith("/settings/exercise-management")) {
    return "운동종목 카탈로그를 관리하고 운동 추가 화면에 즉시 반영합니다.";
  }
  return "설정 변경사항은 저장 즉시 반영됩니다.";
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

  if (isRoot) return <>{children}</>;

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
  const isExerciseManagement = pathname.startsWith("/settings/exercise-management");
  const modalClassName = `settings-child-modal${isExerciseManagement ? " settings-child-modal--exercise-management" : ""}`;
  const panelClassName = `settings-child-modal-panel${isExerciseManagement ? " settings-child-modal-panel--fixed-height" : ""}`;

  return (
    <>
      <SettingsHomeContent />
      <BottomSheet
        open={sheetOpen}
        onClose={onClose}
        title={modalTitleFromPathname(pathname)}
        description={modalDescriptionFromPathname(pathname)}
        closeLabel="닫기"
        panelClassName={panelClassName}
        primaryAction={headerAction}
      >
        <div>{children}</div>
      </BottomSheet>
    </>
  );
}
