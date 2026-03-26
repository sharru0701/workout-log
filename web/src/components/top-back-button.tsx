"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function titleFromPathname(pathname: string) {
  if (pathname === "/") return "홈";
  if (pathname.startsWith("/workout/log/add-exercise")) return "운동 추가";
  if (pathname.startsWith("/workout/log/exercise-catalog")) return "운동 카탈로그";
  if (pathname.startsWith("/workout/log")) return "기록";
  if (pathname.startsWith("/program-store/create")) return "프로그램 만들기";
  if (pathname.startsWith("/program-store/customize")) return "프로그램 수정";
  if (pathname.startsWith("/program-store/detail")) return "프로그램 상세";
  if (pathname.startsWith("/program-store")) return "프로그램";
  if (pathname.startsWith("/stats")) return "통계";
  if (pathname.startsWith("/settings/theme")) return "테마";
  if (pathname.startsWith("/settings/minimum-plate")) return "최소 원판";
  if (pathname.startsWith("/settings/bodyweight")) return "몸무게";
  if (pathname.startsWith("/settings/exercise-management")) return "운동종목 관리";
  if (pathname.startsWith("/settings/data-export")) return "데이터 내보내기";
  if (pathname.startsWith("/settings/about")) return "앱 정보";
  if (pathname.startsWith("/settings")) return "설정";
  return "운동 기록";
}

export function TopBackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const title = titleFromPathname(pathname);
  const topNavClassName = "app-top-nav";
  const isSettingsRoute = pathname.startsWith("/settings");

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  return (
    <div>
      <div>
        <button type="button" onClick={handleBack} aria-label="Go back">
          <span aria-hidden="true" />
        </button>
      </div>
      <div>{title}</div>
      <div>
        <Link
          href="/settings"
          aria-label="Settings"
          aria-current={isSettingsRoute ? "page" : undefined}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}
