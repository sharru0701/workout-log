import type { ChangeEvent } from "react";

type StoreSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  shellAriaLabel?: string;
  clearAriaLabel?: string;
};

export function StoreSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  shellAriaLabel,
  clearAriaLabel = "검색어 지우기",
}: StoreSearchInputProps) {
  const hasQuery = value.trim().length > 0;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div aria-label={shellAriaLabel}>
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
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
      />
      {hasQuery ? (
        <button type="button" aria-label={clearAriaLabel} onClick={() => onChange("")}>
          ×
        </button>
      ) : null}
    </div>
  );
}
