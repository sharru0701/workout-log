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
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <NoticeStateRows message={notice} tone="success" label="초기화 완료" />
      <NoticeStateRows message={error} tone="warning" label="초기화 실패" />

      <section className="grid gap-2">
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

      <section className="grid gap-2">
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
          className="haptic-tap rounded-xl border px-4 py-3 text-base font-semibold text-[var(--color-danger)] disabled:opacity-50"
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
