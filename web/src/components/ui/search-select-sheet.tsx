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
      <span>{label}</span>
      <div data-no-swipe="true">
        <div>
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
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
          />
          {query.trim().length > 0 ? (
            <button type="button" aria-label="검색어 지우기" onClick={resolvedClearQuery}>
              ×
            </button>
          ) : null}
        </div>

        {selectionSummary}

        {!hideOptions ? (
          <div role="listbox" aria-label={resultsAriaLabel}>
            {loading ? (
              <span>{loadingText}</span>
            ) : options.length === 0 ? (
              <span>{emptyText}</span>
            ) : (
              options.map((option) => (
                <button
                  key={option.key}
                  type="button"
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
