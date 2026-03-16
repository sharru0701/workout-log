"use client";

import type { ReactNode } from "react";
import type { BottomSheetPrimaryAction } from "@/components/ui/bottom-sheet-action-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent } from "@/components/ui/card";

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
  const resolvedClearQuery = () => {
    if (onClearQuery) {
      onClearQuery();
      return;
    }
    onQueryChange("");
  };

  return (
    <label>
      {label ? <span>{label}</span> : null}
      <div data-no-swipe="true">
        <div style={{ position: "relative", marginBottom: "var(--space-md)" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }}>
            <svg viewBox="0 0 24 24" focusable="false" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
          </span>
          <input
            type="search"
            inputMode="search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !onQuerySubmit) return;
              event.preventDefault();
              onQuerySubmit();
            }}
            style={{ width: "100%", padding: "10px 12px 10px 40px", border: "1px solid var(--color-border)", borderRadius: "8px", font: "var(--font-body)", backgroundColor: "var(--color-surface)", color: "var(--color-text)", outline: "none" }}
          />
          {query.trim().length > 0 ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={resolvedClearQuery}
              style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: "20px", color: "var(--color-text-muted)", padding: "4px", cursor: "pointer" }}
            >
              ×
            </button>
          ) : null}
        </div>

        {selectionSummary}

        {!hideOptions ? (
          <div role="listbox" aria-label={resultsAriaLabel} style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "300px", overflowY: "auto" }}>
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
      <div>
        <Card padding="md" elevated={false}>
          <CardContent>
            <SearchSelectCombobox {...comboboxProps} />
          </CardContent>
        </Card>
        {children}
      </div>
    </BottomSheet>
  );
}
