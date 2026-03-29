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
              <span style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{loadingText}</span>
            ) : options.length === 0 ? (
              <span style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>{emptyText}</span>
            ) : (
              options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-current={option.ariaCurrent ? "true" : undefined}
                  onClick={option.onSelect}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: "11px 12px",
                    border: option.active ? "1px solid var(--color-selected-border)" : "1px solid transparent",
                    borderRadius: "10px",
                    backgroundColor: option.active ? "var(--color-action-weak)" : "transparent",
                    color: option.active ? "var(--color-action-strong)" : "var(--color-text)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: option.active ? 700 : 500,
                    letterSpacing: option.active ? "-0.1px" : "0",
                    transition: "background-color 0.12s ease",
                  }}
                >
                  <span style={{ flex: 1 }}>{option.label}</span>
                  {option.active && (
                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500", flexShrink: 0, color: "var(--color-primary)" }}>check</span>
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
