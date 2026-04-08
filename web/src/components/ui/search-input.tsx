import type { ChangeEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { Card } from "@/components/ui/card";

type SearchInputRowProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  placeholder?: string;
  ariaLabel: string;
  clearAriaLabel?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * SearchInputRow — card 없이 아이콘 + input + clear 버튼만 렌더링.
 * Card 안에 삽입할 때 사용.
 */
export function SearchInputRow({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  onKeyDown,
}: SearchInputRowProps) {
  const { locale } = useLocale();
  const resolvedPlaceholder = placeholder ?? (locale === "ko" ? "검색" : "Search");
  const resolvedClearAriaLabel = clearAriaLabel ?? (locale === "ko" ? "검색어 지우기" : "Clear search");
  const hasQuery = value.trim().length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
      {/* magnifier icon */}
      <span
        aria-hidden="true"
        className="search-magnifier-icon"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flexShrink: 0,
          color: "var(--color-text-muted)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'wght' 400" }}>search</span>
      </span>

      {/* bare input — card provides the visual container */}
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={onChange}
        placeholder={resolvedPlaceholder}
        aria-label={ariaLabel}
        className="search-card-input"
        onKeyDown={onKeyDown}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--font-body)",
          color: "var(--color-text)",
          minWidth: 0,
        }}
      />

      {/* clear button */}
      {hasQuery ? (
        <button
          type="button"
          aria-label={resolvedClearAriaLabel}
          onClick={onClear}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--color-text-muted)",
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'wght' 500" }}>close</span>
        </button>
      ) : null}
    </div>
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** 제공 시 기본 onChange("") 대신 호출됨 */
  onClear?: () => void;
  placeholder?: string;
  ariaLabel: string;
  clearAriaLabel?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /**
   * bare=true: 카드 없이 input 형태로 렌더링.
   * 포커스 링은 .search-bare-focus-ring CSS로 처리.
   */
  bare?: boolean;
};

/**
 * SearchInput — 독립형 검색 컴포넌트.
 * - 기본(bare=false): Card(inset) 기반, .search-card-focus-ring으로 포커스 링 처리.
 * - bare=true: 일반 input 형태, .search-bare-focus-ring으로 포커스 링 처리.
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  onKeyDown,
  bare = false,
}: SearchInputProps) {
  const row = (
    <SearchInputRow
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClear={onClear ?? (() => onChange(""))}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      clearAriaLabel={clearAriaLabel}
      onKeyDown={onKeyDown}
    />
  );

  if (bare) {
    return (
      <div
        className="search-bare-focus-ring"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "var(--space-sm) var(--space-md)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: "var(--color-surface-container-low)",
          boxSizing: "border-box",
        }}
      >
        {row}
      </div>
    );
  }

  return (
    <div className="search-card-focus-ring">
      <Card padding="sm" tone="inset" elevated={false}>
        {row}
      </Card>
    </div>
  );
}
