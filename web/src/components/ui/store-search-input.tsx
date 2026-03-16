import type { ChangeEvent } from "react";

type StoreSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  shellAriaLabel?: string;
  clearAriaLabel?: string;
  chrome?: "outlined" | "plain";
};

export function StoreSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  shellAriaLabel,
  clearAriaLabel = "검색어 지우기",
  chrome = "outlined",
}: StoreSearchInputProps) {
  const hasQuery = value.trim().length > 0;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div
      aria-label={shellAriaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-sm) var(--space-md)",
        border: chrome === "outlined" ? "1px solid var(--color-border)" : "none",
        borderRadius: "8px",
        backgroundColor: chrome === "outlined" ? "var(--color-surface)" : "transparent",
      }}
    >
      <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
      </span>
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", font: "var(--font-body)", minWidth: 0 }}
      />
      {hasQuery ? (
        <button type="button" aria-label={clearAriaLabel} onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-muted)", padding: "0 4px" }}>
          ×
        </button>
      ) : null}
    </div>
  );
}
