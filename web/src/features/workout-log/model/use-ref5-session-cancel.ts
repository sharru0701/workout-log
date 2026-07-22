"use client";

import { useCallback, useState } from "react";

import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { apiDelete } from "@/lib/api";
import { errorMessage } from "@/lib/error-message";
import { clearWorkoutDraft } from "@/lib/storage/workoutDraftStore";

/**
 * 시작된 REF5 세션은 저장 전까지 날짜·플랜 전환을 잠근다(스냅샷 불변성).
 * 잘못 시작한 세션을 되돌릴 길이 없으면 그날 하루는 다른 플랜으로 갈 수 없으므로 취소를 제공한다.
 */
export function useRef5SessionCancel({
  planId,
  sessionId,
  dateKey,
  persistenceKey,
  enabled,
  locale,
}: {
  planId: string;
  sessionId: string | null | undefined;
  dateKey: string;
  persistenceKey: string | null;
  enabled: boolean;
  locale: string;
}) {
  const { alert, confirm } = useAppDialog();
  const [cancelling, setCancelling] = useState(false);

  const canCancel = enabled && Boolean(sessionId && planId);

  const handleCancel = useCallback(async () => {
    if (!sessionId || !planId) return;
    const ok = await confirm({
      title: locale === "ko" ? "세션 취소" : "Cancel Session",
      message:
        locale === "ko"
          ? "시작한 REF5 세션을 취소합니다.\n입력 중이던 내용은 저장되지 않고, 진행 상태는 시작 전으로 되돌아갑니다."
          : "This cancels the started REF5 session.\nUnsaved entries are discarded and progression returns to its pre-start state.",
      confirmText: locale === "ko" ? "세션 취소" : "Cancel Session",
      cancelText: locale === "ko" ? "닫기" : "Close",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setCancelling(true);
      await apiDelete(
        `/api/plans/${encodeURIComponent(planId)}/generated-sessions/${encodeURIComponent(sessionId)}`,
      );
      if (persistenceKey) {
        await clearWorkoutDraft(persistenceKey).catch(() => {});
      }
      // 세션 컨텍스트(URL·SSR 부트스트랩·복원 draft)가 모두 얽혀 있어, 취소 후에는
      // sessionId 없는 URL로 새로 진입시키는 편이 상태가 확실하다.
      window.location.replace(
        `/workout/log?planId=${encodeURIComponent(planId)}&date=${encodeURIComponent(dateKey)}`,
      );
    } catch (e) {
      setCancelling(false);
      await alert({
        title: locale === "ko" ? "세션 취소 실패" : "Could not cancel",
        message:
          errorMessage(e) ??
          (locale === "ko" ? "세션을 취소하지 못했습니다." : "Could not cancel the session."),
        buttonText: locale === "ko" ? "확인" : "OK",
        tone: "danger",
      });
    }
  }, [alert, confirm, dateKey, locale, persistenceKey, planId, sessionId]);

  return { canCancel, cancelling, handleCancel };
}
