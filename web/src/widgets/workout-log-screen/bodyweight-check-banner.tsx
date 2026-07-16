"use client";

import { useState } from "react";
import { V2Card, V2PrimaryBtn, V2SecondaryBtn, V2TextField } from "@/components/v2/primitives";

type Locale = "ko" | "en";

type Props = {
  currentKg: number | null;
  locale: Locale;
  submitting?: boolean;
  onUpdate: (kg: number) => void;
  onKeep: () => void;
};

// "중량풀업 세션 — 체중 확인" 안내. 중량풀업은 총중량(체중+추가)으로 기록·추적되므로,
// 중량풀업을 수행하는 모든 프로그램에서 (마지막 확인 후 14일+일 때) 체중 갱신/유지를 권고한다.
// 매번 입력시키지 않고 "유지"가 한 탭. presentational — 영속화/디스미스는 호출부가 담당.
export function BodyweightCheckBanner({
  currentKg,
  locale,
  submitting = false,
  onUpdate,
  onKeep,
}: Props) {
  const [value, setValue] = useState(currentKg !== null ? String(currentKg) : "");

  const parsed = Number(value);
  const canUpdate = Number.isFinite(parsed) && parsed > 0 && !submitting;

  return (
    <V2Card tone="accent" padding="var(--v2-s-4)" radius="var(--v2-r-2)">
      <div style={{ display: "grid", gap: "var(--v2-s-3)" }}>
        <div style={{ display: "grid", gap: "var(--v2-s-1)" }}>
          <p className="v2-label" style={{ color: "var(--v2-accent-ink)" }}>
            {locale === "ko" ? "중량풀업 · 체중 확인" : "Weighted pull-up · Bodyweight"}
          </p>
          <p className="v2-small" style={{ color: "var(--v2-ink-2)", maxWidth: "62ch" }}>
            {locale === "ko"
              ? "오늘 중량풀업이 있어요. 총중량(체중+추가)을 정확히 기록·추적하려면 오늘 체중을 확인하세요. 그대로면 유지하세요."
              : "Today includes weighted pull-ups. Confirm today's bodyweight for an accurate total-load record, or keep the current value."}
          </p>
        </div>

        <V2TextField
          size="sm"
          type="number"
          inputMode="decimal"
          icon="monitor_weight"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={locale === "ko" ? "오늘 체중(kg)" : "Today's bodyweight (kg)"}
          trailing={<span className="v2-label" style={{ color: "var(--v2-ink-2)" }}>kg</span>}
        />

        <div style={{ display: "flex", gap: "var(--v2-s-2)", flexWrap: "wrap" }}>
          <V2PrimaryBtn
            icon="check"
            disabled={!canUpdate}
            onClick={() => {
              if (canUpdate) onUpdate(Math.round(parsed * 10) / 10);
            }}
          >
            {locale === "ko" ? "업데이트" : "Update"}
          </V2PrimaryBtn>
          <V2SecondaryBtn icon="do_not_disturb_on" onClick={onKeep}>
            {locale === "ko" ? "유지" : "Keep"}
          </V2SecondaryBtn>
        </div>
      </div>
    </V2Card>
  );
}
