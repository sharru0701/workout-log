import {
  amrapDeferredBannerCopy,
  amrapEveNoticeCopy,
  lightBlockBadgeCopy,
} from "@/features/workout-log/model/progression-feedback";
import type { usePlanProgressionFeedback } from "@/features/workout-log/model/use-plan-progression-feedback";
import type { AppLocale } from "@/lib/i18n/messages";

import { BlockJudgmentCard, SessionFeedbackNotice } from "./hybrid-feedback-banners";

type ProgressionFeedback = ReturnType<typeof usePlanProgressionFeedback>;

/**
 * v0.5.1 실패 프로토콜 피드백(F1~F5) 표출.
 * 판정 파생은 전부 모델(progression-feedback.ts + 훅)에 있고 여기는 조립만 한다.
 */
export function SessionFeedbackNotices({
  feedback,
  amrapDeferred,
  showAmrapEveNotice,
  locale,
}: {
  feedback: ProgressionFeedback;
  amrapDeferred: boolean;
  showAmrapEveNotice: boolean;
  locale: AppLocale;
}) {
  return (
    <>
      {feedback.earlyDeloadBanner ? (
        // 문구는 서버 조립(feedback-catalog) — 그대로 출력(TUI와 동일 문구 보장).
        <SessionFeedbackNotice
          tone="warning"
          title={feedback.earlyDeloadBanner.title}
          body={feedback.earlyDeloadBanner.body}
        />
      ) : null}
      {feedback.blockReport ? (
        <BlockJudgmentCard
          locale={locale}
          title={feedback.blockReport.title}
          rows={feedback.blockReport.rows}
          onDismiss={feedback.dismissBlockReport}
        />
      ) : null}
      {amrapDeferred ? (
        <SessionFeedbackNotice tone="info" {...amrapDeferredBannerCopy(locale)} />
      ) : null}
      {feedback.showLightBlockBadge ? (
        <SessionFeedbackNotice tone="recovery" {...lightBlockBadgeCopy(locale)} />
      ) : null}
      {showAmrapEveNotice ? (
        <SessionFeedbackNotice tone="info" {...amrapEveNoticeCopy(locale)} />
      ) : null}
    </>
  );
}
