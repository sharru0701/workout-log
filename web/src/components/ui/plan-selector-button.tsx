import type { ComponentPropsWithoutRef } from "react";

type PlanSelectorButtonProps = Omit<ComponentPropsWithoutRef<"button">, "type"> & {
  planName: string;
};

export function PlanSelectorButton({ planName, disabled, ...props }: PlanSelectorButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="플랜 선택 열기"
      aria-haspopup="dialog"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        textAlign: "left",
        padding: "14px 18px",
        background: "var(--color-surface-container-low)",
        border: "none",
        borderRadius: "20px",
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s",
      }}
      {...props}
    >
      <div>
        <div style={{
          fontFamily: "var(--font-label-family)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          marginBottom: "4px",
        }}>
          진행 중인 플랜
        </div>
        <div style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: "15px",
          fontWeight: 700,
          color: "var(--color-text)",
        }}>
          {planName}
        </div>
      </div>
      {!disabled && (
        <span aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'wght' 400" }}>unfold_more</span>
        </span>
      )}
    </button>
  );
}
