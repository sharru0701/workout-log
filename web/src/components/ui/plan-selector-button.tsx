import type { ComponentPropsWithoutRef } from "react";
import { Card } from "./card";

type PlanSelectorButtonProps = Omit<ComponentPropsWithoutRef<"button">, "type"> & {
  planName: string;
};

export function PlanSelectorButton({ planName, disabled, ...props }: PlanSelectorButtonProps) {
  return (
    <Card
      as="button"
      type="button"
      interactive={!disabled}
      padding="md"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
      }}
      aria-label="플랜 선택 열기"
      aria-haspopup="dialog"
      disabled={disabled}
      {...props}
    >
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-meta)", marginBottom: "4px" }}>진행 중인 플랜</div>
        <div style={{ font: "var(--font-card-title)", fontWeight: 700, color: "var(--text-plan-name)" }}>
          {planName}
        </div>
      </div>
      <span aria-hidden="true" style={{ color: "var(--color-text-muted)" }}>
        <svg viewBox="0 0 12 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M2 5.5L6 2L10 5.5" />
          <path d="M2 10.5L6 14L10 10.5" />
        </svg>
      </span>
    </Card>
  );
}
