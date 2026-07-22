import { V2SecondaryBtn } from "@/components/v2/primitives";
import type { AppLocale } from "@/lib/i18n/messages";
import { formatDateFriendly } from "@/lib/workout-record/last-session-summary";

import { DateNav } from "./date-nav";

/** 날짜 이동 + (REF5) 세션 취소 + 오늘의 운동 열기 버튼을 한 줄에 놓는 세션 툴바. */
export function SessionToolbar({
  dateKey,
  locale,
  copy,
  onShiftDate,
  onPickDate,
  dateDisabled,
  sessionLabel,
  canCancelSession,
  cancelling,
  onCancelSession,
  onOpenSummary,
}: {
  dateKey: string;
  locale: AppLocale;
  copy: {
    dateChangeAriaLabel: string;
    dateNavPrev: string;
    dateNavNext: string;
  };
  onShiftDate: (delta: number) => void;
  onPickDate: (dateKey: string) => void;
  dateDisabled: boolean;
  sessionLabel: string | null;
  canCancelSession: boolean;
  cancelling: boolean;
  onCancelSession: () => void;
  /** null이면 요약 버튼을 렌더하지 않는다(시작된 REF5 세션). */
  onOpenSummary: (() => void) | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--v2-s-2)",
        alignItems: "stretch",
      }}
    >
      <DateNav
        dateKey={dateKey}
        label={formatDateFriendly(dateKey, locale)}
        onPrev={() => onShiftDate(-1)}
        onNext={() => onShiftDate(1)}
        onPick={onPickDate}
        ariaLabel={copy.dateChangeAriaLabel}
        prevLabel={copy.dateNavPrev}
        nextLabel={copy.dateNavNext}
        disabled={dateDisabled}
        style={{ flex: 1, minWidth: 0 }}
      />
      {canCancelSession ? (
        <V2SecondaryBtn
          tone="danger"
          icon="close"
          disabled={cancelling}
          onClick={onCancelSession}
        >
          {cancelling
            ? locale === "ko"
              ? "취소 중"
              : "Cancelling"
            : locale === "ko"
              ? "세션 취소"
              : "Cancel"}
        </V2SecondaryBtn>
      ) : null}
      {onOpenSummary ? (
        <button
          type="button"
          onClick={onOpenSummary}
          aria-label={
            locale === "ko"
              ? `오늘의 운동 보기${sessionLabel ? ` · ${sessionLabel}` : ""}`
              : `View today's workout${sessionLabel ? ` · ${sessionLabel}` : ""}`
          }
          className="v2-font-display"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--v2-s-3)",
            padding: "var(--v2-s-2) var(--v2-s-5)",
            borderRadius: "var(--v2-r-2)",
            background: "var(--v2-paper-2)",
            color: "var(--v2-ink)",
            border: "none",
            cursor: "pointer",
            minHeight: "var(--v2-s-8)",
            flexShrink: 0,
            fontWeight: 700,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "var(--v2-t-18)" }}
            aria-hidden
          >
            list_alt
          </span>
          {sessionLabel ? (
            <span
              className="v2-mono-label"
              style={{
                color: "var(--v2-ink)",
                fontSize: "var(--v2-t-12)",
                letterSpacing: "0.02em",
              }}
            >
              {sessionLabel}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
