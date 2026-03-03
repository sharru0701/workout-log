"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SettingsHomeContent } from "@/components/settings/settings-home-content";
import { BottomSheet } from "@/components/ui/bottom-sheet";

function modalTitleFromPathname(pathname: string) {
  if (pathname.startsWith("/settings/theme")) return "테마 설정";
  if (pathname.startsWith("/settings/minimum-plate")) return "최소 원판 무게";
  if (pathname.startsWith("/settings/bodyweight")) return "몸무게 입력";
  if (pathname.startsWith("/settings/exercise-management")) return "운동종목 관리";
  if (pathname.startsWith("/settings/data-export")) return "데이터 Export";
  if (pathname.startsWith("/settings/data")) return "데이터 관리";
  if (pathname.startsWith("/settings/offline-help")) return "오프라인 도움말";
  if (pathname.startsWith("/settings/about")) return "앱 정보";
  if (pathname.startsWith("/settings/save-policy")) return "저장 정책";
  if (pathname.startsWith("/settings/selection-template")) return "선택 템플릿";
  if (pathname.startsWith("/settings/ux-thresholds")) return "UX 기준치";
  return "설정 상세";
}

function modalDescriptionFromPathname(pathname: string) {
  if (pathname.startsWith("/settings/exercise-management")) {
    return "운동종목 카탈로그를 관리하고 운동 추가 화면에 즉시 반영합니다.";
  }
  return "설정 변경사항은 저장 즉시 반영됩니다.";
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/settings";
  const router = useRouter();
  const isRoot = pathname === "/settings";

  if (isRoot) return <>{children}</>;

  return (
    <>
      <SettingsHomeContent className="settings-child-modal-background" />
      <BottomSheet
        open
        onClose={() => router.push("/settings")}
        title={modalTitleFromPathname(pathname)}
        description={modalDescriptionFromPathname(pathname)}
        closeLabel="닫기"
        className="settings-child-modal"
        panelClassName="settings-child-modal-panel"
      >
        <div className="settings-child-modal-content">{children}</div>
      </BottomSheet>
    </>
  );
}
