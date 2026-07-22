import type { CSSProperties } from "react";

/** 이전/다음 화살표 + 라벨을 덮는 투명 date input. 라벨 전체가 날짜 선택 히트영역이다. */
export function DateNav({
  dateKey,
  label,
  onPrev,
  onNext,
  onPick,
  ariaLabel,
  prevLabel,
  nextLabel,
  disabled = false,
  style,
}: {
  dateKey: string;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onPick: (newDate: string) => void;
  ariaLabel: string;
  prevLabel: string;
  nextLabel: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--v2-s-1)",
        padding: "var(--v2-s-1) var(--v2-s-3)",
        borderRadius: "var(--v2-r-2)",
        background: "var(--v2-paper-2)",
        minHeight: "var(--v2-s-8)",
        ...style,
      }}
    >
      <button
        type="button"
        className="date-nav-btn"
        aria-label={prevLabel}
        onClick={onPrev}
        disabled={disabled}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: "var(--v2-t-18)", fontVariationSettings: "'wght' 400" }}
        >
          chevron_left
        </span>
      </button>
      <label
        className="v2-font-display"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          minHeight: "var(--v2-touch)",
          fontWeight: 700,
          color: "var(--v2-ink)",
          opacity: disabled ? 0.72 : 1,
        }}
      >
        <span aria-live="polite">{label}</span>
        <input
          type="date"
          aria-label={ariaLabel}
          value={dateKey}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) onPick(e.target.value);
          }}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            cursor: disabled ? "default" : "pointer",
          }}
        />
      </label>
      <button
        type="button"
        className="date-nav-btn"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={disabled}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: "var(--v2-t-18)", fontVariationSettings: "'wght' 400" }}
        >
          chevron_right
        </span>
      </button>
    </span>
  );
}
