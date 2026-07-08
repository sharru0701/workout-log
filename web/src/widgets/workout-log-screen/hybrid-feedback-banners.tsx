"use client";

import { V2Card, V2SecondaryBtn } from "@/components/v2/primitives";
import { useThemeSkin } from "@/components/use-theme-skin";
import type { BlockJudgmentRow } from "@/features/workout-log/model/progression-feedback";

type Locale = "ko" | "en";
type NoticeTone = "warning" | "info" | "recovery";

// v0.5.1 실패 프로토콜 피드백 표출(F1·F3·F4·F5 공용 노티스 + F2 판정 카드).
// BodyweightCheckBanner와 같은 presentational 패턴 — 노출 판정·영속화는 호출부(모델 훅) 담당.
// terminal 스킨은 TUI 패널(box-inset·모노·색만)로 분기.

const TERM_TONE_COLOR: Record<NoticeTone, string> = {
  warning: "var(--term-amber)",
  info: "var(--term-cyan)",
  recovery: "var(--term-dim)",
};

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
  const skin = useThemeSkin();
  if (skin === "terminal") {
    return (
      <div
        role="status"
        style={{
          padding: "var(--v2-s-3) var(--v2-s-4)",
          background: "var(--term-panel)",
          boxShadow: "inset 0 0 0 1px var(--term-line-box)",
          display: "grid",
          gap: "var(--v2-s-1)",
        }}
      >
        <p className="v2-mono-label" style={{ color: TERM_TONE_COLOR[tone] }}>
          ‹ {title} ›
        </p>
        <p className="v2-mono-label" style={{ color: "var(--term-dim)", maxWidth: "62ch", lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
    );
  }
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
  rows: BlockJudgmentRow[];
  onDismiss: () => void;
};

export function BlockJudgmentCard({ locale, rows, onDismiss }: BlockJudgmentCardProps) {
  const skin = useThemeSkin();
  const title = locale === "ko" ? "블록 판정 — TM 변경 요약" : "Block judgment — TM changes";
  const dismissLabel = locale === "ko" ? "확인" : "Got it";

  if (skin === "terminal") {
    return (
      <div
        role="status"
        style={{
          padding: "var(--v2-s-4)",
          background: "var(--term-panel)",
          boxShadow: "inset 0 0 0 1px var(--term-line-box)",
          display: "grid",
          gap: "var(--v2-s-2)",
        }}
      >
        <p className="v2-mono-label" style={{ color: "var(--term-amber)" }}>
          ‹ {title} ›
        </p>
        <div style={{ display: "grid", gap: "var(--v2-s-1)" }}>
          {rows.map((row) => (
            <p key={row.target} className="v2-mono-label" style={{ color: "var(--term-cyan)", lineHeight: 1.5 }}>
              {row.text}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            justifySelf: "start",
            fontFamily: "var(--term-mono)",
            fontSize: "var(--v2-t-14)",
            minHeight: "var(--v2-touch)",
            padding: "0 var(--v2-s-2)",
            background: "transparent",
            color: "var(--term-amber)",
            border: "none",
            cursor: "pointer",
          }}
        >
          [{dismissLabel}]
        </button>
      </div>
    );
  }

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
