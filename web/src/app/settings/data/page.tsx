"use client";

import { useState } from "react";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { NoticeStateRows } from "@/components/ui/settings-state";
import { apiInvalidateCache, apiPost } from "@/lib/api";

type ResetAppDataResponse = {
  ok: boolean;
  summary?: {
    triggeredBy: string;
    baseTemplateCount: number;
    baseExerciseCount: number;
    includeDemoPlans: boolean;
  };
};

const LOCAL_STORAGE_PREFIXES = ["workout-log.setting.v1."];
const LOCAL_STORAGE_KEYS = [
  "workout-log.pending-logs.v1",
  "workoutlog:ux-events",
  "workoutlog:ux-events-synced-ids",
  "workoutlog:focus-mode",
] as const;

function clearLocalAppState() {
  apiInvalidateCache();
  if (typeof window === "undefined") return;

  try {
    const removeKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (LOCAL_STORAGE_KEYS.includes(key as (typeof LOCAL_STORAGE_KEYS)[number])) {
        removeKeys.push(key);
        continue;
      }
      if (LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        removeKeys.push(key);
      }
    }
    for (const key of removeKeys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // noop
  }


}

export default function SettingsDataPage() {
  const { confirm, alert } = useAppDialog();
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const runClearCache = async () => {
    const confirmed = await confirm({
      title: "캐시 전체 삭제",
      message: "서버 통계 캐시, 클라이언트 API 캐시, 브라우저 캐시(Service Worker)를 모두 삭제합니다.\n\n운동 기록이나 설정은 변경되지 않습니다.",
      confirmText: "삭제",
      cancelText: "취소",
      tone: "default",
    });
    if (!confirmed) return;

    try {
      setClearingCache(true);
      setError(null);
      setNotice(null);

      await apiPost("/api/settings/clear-cache", {});
      apiInvalidateCache();

      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }

      setNotice("캐시를 성공적으로 삭제했습니다.");
    } catch (e: any) {
      const message = e?.message ?? "캐시 삭제에 실패했습니다.";
      setError(message);
      await alert({
        title: "캐시 삭제 실패",
        message,
        tone: "danger",
      });
    } finally {
      setClearingCache(false);
    }
  };

  const runReset = async () => {
    const confirmed = await confirm({
      title: "앱 데이터 초기화",
      message:
        "기존 운동기록, 세트, 플랜, 커스텀 프로그램, 통계 캐시, 사용자 설정, UX 이벤트를 모두 삭제합니다.\n\n기본 프로그램 템플릿과 기본 운동종목은 새로 다시 세팅됩니다.\n이 작업은 복구할 수 없습니다.",
      confirmText: "초기화",
      cancelText: "취소",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setResetting(true);
      setError(null);
      setNotice(null);

      const response = await apiPost<ResetAppDataResponse>("/api/settings/app-reset", {
        confirmToken: "RESET_APP_DATA",
      });

      clearLocalAppState();

      await apiPost("/api/settings/clear-cache", {});
      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }

      const summary =
        response.summary
          ? `기본 템플릿 ${response.summary.baseTemplateCount}개와 운동종목 ${response.summary.baseExerciseCount}개를 다시 세팅했습니다.`
          : "기본 템플릿과 운동종목을 다시 세팅했습니다.";

      setNotice("앱 데이터 초기화를 완료했습니다.");
      await alert({
        title: "초기화 완료",
        message: `앱 데이터를 초기 상태로 되돌렸습니다.\n${summary}\n\n확인 후 설정 홈으로 돌아갑니다.`,
      });

      window.location.assign("/settings");
    } catch (e: any) {
      const message = e?.message ?? "앱 데이터 초기화에 실패했습니다.";
      setError(message);
      await alert({
        title: "초기화 실패",
        message,
        tone: "danger",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <NoticeStateRows message={notice} tone="success" label="초기화 완료" />
      <NoticeStateRows message={error} tone="warning" label="초기화 실패" />

      <section>
        <SectionHeader title="캐시 관리" description="캐시가 오래되거나 표시 오류가 있을 때 수동으로 삭제할 수 있습니다." />
        <BaseGroupedList ariaLabel="Cache actions">
          <InfoRow
            label="서버 통계 캐시"
            description="e1rm, 볼륨, 준수율, PR 등 집계 결과물"
            value="Stats"
            tone="neutral"
          />
          <InfoRow
            label="브라우저 캐시"
            description="Service Worker가 보관하는 오프라인용 리소스 캐시"
            value="SW Cache"
            tone="neutral"
          />
        </BaseGroupedList>
        <button
          type="button"
          className="btn btn-secondary btn-full"
          style={{ marginTop: "var(--space-sm)" }}
          onClick={() => {
            void runClearCache();
          }}
          disabled={clearingCache}
        >
          {clearingCache ? "캐시 삭제 중..." : "캐시 전체 삭제"}
        </button>
        <SectionFootnote>삭제 후 다음 조회 시 자동으로 재생성됩니다. 운동 기록과 설정은 변경되지 않습니다.</SectionFootnote>
      </section>

      <section>
        <SectionHeader title="데이터 작업" description="내보내기와 전체 초기화를 한 화면에서 관리합니다." />
        <BaseGroupedList ariaLabel="Data actions">
          <NavigationRow
            href="/settings/data-export"
            label="데이터 Export"
            subtitle="Backup"
            description="초기화 전에 JSON / CSV 백업을 생성합니다."
            value="열기"
          />
        </BaseGroupedList>
        <SectionFootnote>초기화 전에 먼저 Export로 백업 파일을 보관하는 편이 안전합니다.</SectionFootnote>
      </section>

      <section>
        <SectionHeader title="앱 데이터 초기화" description="앱 전체 데이터를 정리하고 기본 카탈로그만 다시 세팅합니다." />
        <BaseGroupedList ariaLabel="Reset scope">
          <InfoRow
            label="삭제되는 데이터"
            description="운동기록, 세트, 생성 세션, 플랜, 커스텀 프로그램, 통계 캐시, 사용자 설정, UX 이벤트"
            value="전체"
            tone="critical"
          />
          <InfoRow
            label="다시 세팅되는 데이터"
            description="기본 프로그램 템플릿과 기본 운동종목 카탈로그"
            value="Base Seed"
            tone="neutral"
          />
          <InfoRow
            label="생성되지 않는 데이터"
            description="예시 플랜이나 데모 기록은 다시 만들지 않습니다."
            value="Demo 없음"
            tone="neutral"
          />
        </BaseGroupedList>

        <button
          type="button"
          className="btn btn-danger btn-full"
          style={{ marginTop: "var(--space-sm)" }}
          onClick={() => {
            void runReset();
          }}
          disabled={resetting}
        >
          {resetting ? "앱 데이터 초기화 중..." : "앱 데이터 초기화"}
        </button>

        <SectionFootnote>
          이 작업은 앱 전체 데이터를 대상으로 하며 복구할 수 없습니다. 초기화 후 설정 홈으로 돌아가며, 필요한 경우 새 플랜을 다시 생성해야 합니다.
        </SectionFootnote>
      </section>
    </div>
  );
}
