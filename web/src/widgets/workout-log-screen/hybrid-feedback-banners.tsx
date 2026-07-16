"use client";

import { V2Card, V2SecondaryBtn } from "@/components/v2/primitives";
import type { ProgressReportRow } from "@/features/workout-log/model/progression-feedback";

type Locale = "ko" | "en";
type NoticeTone = "warning" | "info" | "recovery";

// v0.5.1 실패 프로토콜 피드백 표출(F1·F3·F4·F5 공용 노티스 + F2 판정 카드).
// BodyweightCheckBanner와 같은 presentational 패턴 — 노출 판정·영속화는 호출부(모델 훅) 담당.
const PAPER_TONE: Record<NoticeTone, "danger" | "accent" | "inset"> = {
  warning: "danger",
  info: "accent",
  recovery: "inset",
};

type NoticeProps = {
  tone: NoticeTone;
  title: string;
  body: string;
};

export function SessionFeedbackNotice({ tone, title, body }: NoticeProps) {
  return (
    <V2Card tone={PAPER_TONE[tone]} padding="var(--v2-s-4)" radius="var(--v2-r-2)">
      <div role="status" style={{ display: "grid", gap: "var(--v2-s-1)" }}>
        <p className="v2-label">{title}</p>
        <p className="v2-small" style={{ color: "var(--v2-ink-2)", maxWidth: "62ch" }}>
          {body}
        </p>
      </div>
    </V2Card>
  );
}

type BlockJudgmentCardProps = {
  locale: Locale;
  // 프로그램 공통화: 제목은 패밀리 카탈로그가 결정해 내려준다(asymptote 하드코딩 금지).
  title: string;
  rows: ProgressReportRow[];
  onDismiss: () => void;
};

export function BlockJudgmentCard({ locale, title, rows, onDismiss }: BlockJudgmentCardProps) {
  const dismissLabel = locale === "ko" ? "확인" : "Got it";

  return (
    <V2Card tone="accent" padding="var(--v2-s-4)" radius="var(--v2-r-2)">
      <div role="status" style={{ display: "grid", gap: "var(--v2-s-3)" }}>
        <p className="v2-label" style={{ color: "var(--v2-accent-ink)" }}>
          {title}
        </p>
        <div style={{ display: "grid", gap: "var(--v2-s-1)" }}>
          {rows.map((row) => (
            <p key={row.target} className="v2-small" style={{ color: "var(--v2-ink)", lineHeight: 1.6 }}>
              {row.text}
            </p>
          ))}
        </div>
        <div>
          <V2SecondaryBtn icon="check" onClick={onDismiss}>
            {dismissLabel}
          </V2SecondaryBtn>
        </div>
      </div>
    </V2Card>
  );
}
