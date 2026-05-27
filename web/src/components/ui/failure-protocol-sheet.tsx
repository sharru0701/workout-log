"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  V2Card,
  V2Hairline,
  V2IconBtn,
  V2Inline,
  V2PrimaryBtn,
  V2SecondaryBtn,
  V2Segmented,
  V2Stack,
} from "@/components/v2/primitives";
import { BottomSheet } from "./bottom-sheet";

export type FailureProtocolChoice = "cancel" | "hold" | "reset" | "increase";

export type FailureProtocolTarget = {
  key: string;
  label: string;
  currentWorkKg: number;
  recommendedIncreaseKg: number;
  recommendedResetKg: number;
};

export type FailureProtocolResult = {
  choice: FailureProtocolChoice;
  targetOverridesKg?: Record<string, number>;
};

type FailureProtocolMode = "increase" | "hold" | "reset";

type FailureProtocolSheetProps = {
  open: boolean;
  title: string;
  description: string;
  /** block-completion: Operator 블록 완료 / greyskull-reset: Greyskull 리셋 기준 도달 */
  mode: "block-completion" | "greyskull-reset";
  targets: FailureProtocolTarget[];
  onSelect: (result: FailureProtocolResult) => void;
};

const STEP_KG = 2.5;

function snapTo2p5(value: number) {
  return Math.max(0, Math.round(value / STEP_KG) * STEP_KG);
}

function formatKg(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
}

function recommendedNextKg(target: FailureProtocolTarget, mode: FailureProtocolMode) {
  if (mode === "increase") return snapTo2p5(target.currentWorkKg + target.recommendedIncreaseKg);
  if (mode === "reset") return snapTo2p5(target.recommendedResetKg);
  return snapTo2p5(target.currentWorkKg);
}

function buildDefaultOverrides(
  targets: FailureProtocolTarget[],
  mode: FailureProtocolMode,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of targets) {
    out[t.key] = recommendedNextKg(t, mode);
  }
  return out;
}

export function FailureProtocolSheet({
  open,
  title,
  description,
  mode,
  targets,
  onSelect,
}: FailureProtocolSheetProps) {
  const { locale } = useLocale();
  const isBlockCompletion = mode === "block-completion";
  const initialMode: FailureProtocolMode = isBlockCompletion ? "increase" : "reset";

  const [selectedMode, setSelectedMode] = useState<FailureProtocolMode>(initialMode);
  const [overrides, setOverrides] = useState<Record<string, number>>(() =>
    buildDefaultOverrides(targets, initialMode),
  );

  // 모달이 열릴 때마다 / 타겟이 바뀔 때마다 기본값 재설정
  useEffect(() => {
    if (!open) return;
    setSelectedMode(initialMode);
    setOverrides(buildDefaultOverrides(targets, initialMode));
  }, [open, targets, initialMode]);

  const handleModeChange = (next: FailureProtocolMode) => {
    setSelectedMode(next);
    setOverrides(buildDefaultOverrides(targets, next));
  };

  const adjustTarget = (key: string, delta: number) => {
    setOverrides((prev) => {
      const current = prev[key] ?? 0;
      return { ...prev, [key]: snapTo2p5(current + delta) };
    });
  };

  const resetTarget = (key: string) => {
    const target = targets.find((t) => t.key === key);
    if (!target) return;
    setOverrides((prev) => ({ ...prev, [key]: recommendedNextKg(target, selectedMode) }));
  };

  const handleSave = () => {
    onSelect({ choice: selectedMode, targetOverridesKg: overrides });
  };

  const modeOptions = useMemo(
    () =>
      [
        {
          value: "increase" as const,
          label: locale === "ko" ? "증량" : "Increase",
          ariaLabel: locale === "ko" ? "증량 모드" : "Increase mode",
        },
        {
          value: "hold" as const,
          label: locale === "ko" ? "유지" : "Hold",
          ariaLabel: locale === "ko" ? "유지 모드" : "Hold mode",
        },
        {
          value: "reset" as const,
          label: locale === "ko" ? "감소" : "Reduce",
          ariaLabel: locale === "ko" ? "감소 모드" : "Reduce mode",
        },
      ],
    [locale],
  );

  return (
    <BottomSheet
      open={open}
      title={title}
      description=""
      onClose={() => onSelect({ choice: "cancel" })}
      closeLabel={locale === "ko" ? "닫기" : "Close"}
      footer={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--v2-s-1)",
            width: "100%",
          }}
        >
          <V2PrimaryBtn full onClick={handleSave}>
            {locale === "ko" ? "저장" : "Save"}
          </V2PrimaryBtn>
          <V2SecondaryBtn full onClick={() => onSelect({ choice: "cancel" })}>
            {locale === "ko" ? "취소" : "Cancel"}
          </V2SecondaryBtn>
        </div>
      }
    >
      <V2Stack gap={4}>
        {description ? (
          <V2Card tone={isBlockCompletion ? "inset" : "danger"} padding="var(--v2-s-4)">
            <p className="v2-body" style={{ whiteSpace: "pre-line", margin: 0 }}>
              {description}
            </p>
          </V2Card>
        ) : null}

        <V2Inline justify="center">
          <V2Segmented<FailureProtocolMode>
            options={modeOptions}
            value={selectedMode}
            onChange={handleModeChange}
            ariaLabel={locale === "ko" ? "증감량 모드" : "Adjustment mode"}
          />
        </V2Inline>

        <V2Stack gap={2}>
          {targets.map((target, index) => {
            const next = overrides[target.key] ?? recommendedNextKg(target, selectedMode);
            const recommended = recommendedNextKg(target, selectedMode);
            const delta = next - target.currentWorkKg;
            const recommendedDelta = recommended - target.currentWorkKg;
            const isRecommended = next === recommended;

            const deltaLabel =
              delta === 0
                ? locale === "ko"
                  ? "유지"
                  : "Hold"
                : `${delta > 0 ? "+" : ""}${formatKg(delta)}kg`;

            const recommendedLabel =
              recommendedDelta === 0
                ? locale === "ko"
                  ? "추천: 유지"
                  : "Recommended: hold"
                : `${locale === "ko" ? "추천" : "Recommended"}: ${recommendedDelta > 0 ? "+" : ""}${formatKg(recommendedDelta)}kg`;

            const deltaColor =
              delta > 0
                ? "var(--v2-success)"
                : delta < 0
                  ? "var(--v2-danger)"
                  : "var(--v2-ink-3)";

            return (
              <div key={target.key}>
                {index > 0 ? <V2Hairline /> : null}
                <V2Card tone="paper" padding="var(--v2-s-3)">
                  <V2Stack gap={2}>
                    <V2Inline justify="space-between" align="baseline">
                      <span className="v2-label" style={{ color: "var(--v2-ink)" }}>
                        {target.label}
                      </span>
                      <span className="v2-small" style={{ color: "var(--v2-ink-3)" }}>
                        {locale === "ko" ? "현재" : "Current"} {formatKg(target.currentWorkKg)}kg
                      </span>
                    </V2Inline>

                    <V2Inline justify="space-between" align="center">
                      <V2IconBtn
                        icon="remove"
                        label={locale === "ko" ? "2.5kg 감소" : "Decrease 2.5kg"}
                        tone="neutral"
                        onClick={() => adjustTarget(target.key, -STEP_KG)}
                      />
                      <V2Stack gap={1} align="center" style={{ flex: 1 }}>
                        <span className="v2-num-lg" style={{ color: "var(--v2-ink)" }}>
                          {formatKg(next)}
                          <span
                            className="v2-small"
                            style={{ color: "var(--v2-ink-3)", marginLeft: "var(--v2-s-1)" }}
                          >
                            kg
                          </span>
                        </span>
                        <span className="v2-small" style={{ color: deltaColor }}>
                          {deltaLabel}
                        </span>
                      </V2Stack>
                      <V2IconBtn
                        icon="add"
                        label={locale === "ko" ? "2.5kg 증가" : "Increase 2.5kg"}
                        tone="neutral"
                        onClick={() => adjustTarget(target.key, STEP_KG)}
                      />
                    </V2Inline>

                    <V2Inline justify="space-between" align="center">
                      <span className="v2-small" style={{ color: "var(--v2-ink-3)" }}>
                        {recommendedLabel}
                      </span>
                      {!isRecommended ? (
                        <button
                          type="button"
                          className="v2-pressable v2-small"
                          onClick={() => resetTarget(target.key)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--v2-accent)",
                            cursor: "pointer",
                            padding: "var(--v2-s-1) var(--v2-s-2)",
                            minHeight: "var(--v2-s-7)",
                          }}
                        >
                          {locale === "ko" ? "추천값으로" : "Use recommended"}
                        </button>
                      ) : null}
                    </V2Inline>
                  </V2Stack>
                </V2Card>
              </div>
            );
          })}
        </V2Stack>
      </V2Stack>
    </BottomSheet>
  );
}
