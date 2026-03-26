"use client";

import type { ReactNode } from "react";
import type { BottomSheetPrimaryAction } from "@/components/ui/bottom-sheet-action-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SearchInput } from "@/components/ui/search-input";

export type SearchSelectOption = {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  active?: boolean;
  ariaCurrent?: boolean;
};

type SearchSelectComboboxProps = {
  label?: string;
  query: string;
  placeholder: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit?: () => void;
  onClearQuery?: () => void;
  resultsAriaLabel: string;
  options: SearchSelectOption[];
  emptyText: string;
  loading?: boolean;
  loadingText?: string;
  selectionSummary?: ReactNode;
  hideOptions?: boolean;
};

type SearchSelectSheetProps = SearchSelectComboboxProps & {
  open: boolean;
  title: string;
  onClose: () => void;
  description?: string;
  closeLabel?: string;
  header?: ReactNode;
  primaryAction?: BottomSheetPrimaryAction | null;
  footer?: ReactNode;
  children?: ReactNode;
};

export function SearchSelectCombobox({
  label,
  query,
  placeholder,
  onQueryChange,
  onQuerySubmit,
  onClearQuery,
  resultsAriaLabel,
  options,
  emptyText,
  loading = false,
  loadingText = "검색 중...",
  selectionSummary,
  hideOptions = false,
}: SearchSelectComboboxProps) {
  return (
    <label>
      {label ? <span>{label}</span> : null}
      <div data-no-swipe="true">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          onClear={onClearQuery}
          placeholder={placeholder}
          ariaLabel={label || placeholder}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !onQuerySubmit) return;
            event.preventDefault();
            onQuerySubmit();
          }}
        />

        {selectionSummary}

        {!hideOptions ? (
          <div
            role="listbox"
            aria-label={resultsAriaLabel}
            style={{ display: "flex", flexDirection: "column", gap: "2px", height: "300px", overflowY: "auto", marginTop: "var(--space-sm)" }}
          >
            {loading ? (
              <span style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{loadingText}</span>
            ) : options.length === 0 ? (
              <span style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{emptyText}</span>
            ) : (
              options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-current={option.ariaCurrent ? "true" : undefined}
                  onClick={option.onSelect}
                  style={{ display: "flex", alignItems: "center", width: "100%", padding: "12px", border: "none", borderRadius: "8px", backgroundColor: option.active ? "var(--color-selected-weak)" : "transparent", color: option.active ? "var(--color-action-strong)" : "var(--color-text)", cursor: "pointer", textAlign: "left", font: "var(--font-body)", fontWeight: option.active ? 600 : 400 }}
                >
                  <span style={{ flex: 1 }}>{option.label}</span>
                  {option.active && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function SearchSelectSheet({
  open,
  title,
  onClose,
  description,
  closeLabel = "닫기",
  header,
  primaryAction,
  footer,
  children,
  ...comboboxProps
}: SearchSelectSheetProps) {
  return (
    <BottomSheet
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      closeLabel={closeLabel}
      header={header}
      primaryAction={primaryAction}
      footer={footer}
    >
      <div style={{ padding: "4px 2px 0 2px" }}>
        <SearchSelectCombobox {...comboboxProps} />
        {children}
      </div>
    </BottomSheet>
  );
}
