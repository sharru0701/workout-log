"use client";

import type { ReactNode } from "react";
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
  label: string;
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
    <label className="grid gap-1">
      <span className="ui-card-label">{label}</span>
      <div className="workout-combobox" data-no-swipe="true">
        <div className="app-search-shell">
          <span className="app-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
          </span>
          <input
            type="search"
            inputMode="search"
            className="app-search-input"
            value={query}
            placeholder={placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !onQuerySubmit) return;
              event.preventDefault();
              onQuerySubmit();
            }}
          />
          {query.trim().length > 0 ? (
            <button type="button" className="app-search-clear" aria-label="검색어 지우기" onClick={resolvedClearQuery}>
              ×
            </button>
          ) : null}
        </div>

        {selectionSummary}

        {!hideOptions ? (
          <div className="workout-combobox-panel" role="listbox" aria-label={resultsAriaLabel}>
            {loading ? (
              <span className="workout-combobox-empty">{loadingText}</span>
            ) : options.length === 0 ? (
              <span className="workout-combobox-empty">{emptyText}</span>
            ) : (
              options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`haptic-tap workout-combobox-option${option.active ? " is-active" : ""}`}
                  aria-current={option.ariaCurrent ? "true" : undefined}
                  onClick={option.onSelect}
                >
                  {option.label}
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
      footer={footer}
    >
      <div className="grid gap-3 pb-2">
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
