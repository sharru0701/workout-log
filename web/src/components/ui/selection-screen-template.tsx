"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BaseGroupedList, NavigationRow, SectionFootnote, SectionHeader } from "./settings-list";
import { EmptyStateRows } from "./settings-state";

type SelectionOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  keywords?: string[];
  disabled?: boolean;
  disabledDescription?: ReactNode;
};

type SelectionLayoutProps = {
  children: ReactNode;
};

type SingleSelectionScreenProps = {
  title: ReactNode;
  sectionTitle?: ReactNode;
  sectionFootnote?: ReactNode;
  options: SelectionOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyDescription?: ReactNode;
  ariaLabel?: string;
};

type MultiSelectionScreenProps = {
  title: ReactNode;
  sectionTitle?: ReactNode;
  sectionFootnote?: ReactNode;
  options: SelectionOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onApply: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyDescription?: ReactNode;
  ariaLabel?: string;
};

type PickerSelectionScreenProps = {
  title: ReactNode;
  sectionTitle?: ReactNode;
  sectionFootnote?: ReactNode;
  inputLabel: ReactNode;
  inputType: "date" | "time" | "number";
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  applyLabel?: ReactNode;
  applyDescription?: ReactNode;
  ariaLabel?: string;
};

function normalizeText(value: ReactNode) {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  return "";
}

function useFilteredOptions(options: SelectionOption[], query: string) {
  return useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const haystack = [
        normalizeText(option.label),
        normalizeText(option.description),
        ...(option.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);
}

function SelectionLayout({ children }: SelectionLayoutProps) {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      {children}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <section className="grid gap-2">
      <SectionHeader title="검색" />
      <div className="app-search-shell" aria-label="검색 입력">
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {value.trim().length > 0 ? (
          <button
            type="button"
            className="app-search-clear"
            aria-label="검색어 지우기"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
      <SectionFootnote>검색어를 입력해 항목을 빠르게 찾습니다.</SectionFootnote>
    </section>
  );
}

export function SingleSelectionScreen({
  title,
  sectionTitle = "옵션",
  sectionFootnote,
  options,
  selectedValue,
  onSelect,
  searchable = false,
  searchPlaceholder = "항목 검색",
  emptyDescription = "조건에 맞는 항목이 없습니다.",
  ariaLabel = "단일 선택 옵션",
}: SingleSelectionScreenProps) {
  void title;
  const [query, setQuery] = useState("");
  const filtered = useFilteredOptions(options, searchable ? query : "");

  return (
    <SelectionLayout>
      {searchable ? <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} /> : null}
      <section className="grid gap-2">
        <SectionHeader title={sectionTitle} />
        {filtered.length === 0 ? (
          <EmptyStateRows when label="설정 값 없음" description={emptyDescription} />
        ) : (
          <BaseGroupedList ariaLabel={ariaLabel}>
            {filtered.map((option) => (
              <NavigationRow
                key={option.value}
                label={option.label}
                description={option.disabled ? option.disabledDescription ?? option.description : option.description}
                value={selectedValue === option.value ? "✓" : undefined}
                onPress={() => onSelect(option.value)}
                showChevron={false}
                disabled={option.disabled}
              />
            ))}
          </BaseGroupedList>
        )}
        {sectionFootnote ? <SectionFootnote>{sectionFootnote}</SectionFootnote> : null}
      </section>
    </SelectionLayout>
  );
}

export function MultiSelectionScreen({
  title,
  sectionTitle = "옵션",
  sectionFootnote,
  options,
  selectedValues,
  onToggle,
  onApply,
  searchable = false,
  searchPlaceholder = "항목 검색",
  emptyDescription = "조건에 맞는 항목이 없습니다.",
  ariaLabel = "다중 선택 옵션",
}: MultiSelectionScreenProps) {
  void title;
  const [query, setQuery] = useState("");
  const filtered = useFilteredOptions(options, searchable ? query : "");
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  return (
    <SelectionLayout>
      {searchable ? <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} /> : null}
      <section className="grid gap-2">
        <SectionHeader title={sectionTitle} />
        {filtered.length === 0 ? (
          <EmptyStateRows when label="설정 값 없음" description={emptyDescription} />
        ) : (
          <BaseGroupedList ariaLabel={ariaLabel}>
            {filtered.map((option) => (
              <NavigationRow
                key={option.value}
                label={option.label}
                description={option.disabled ? option.disabledDescription ?? option.description : option.description}
                value={selectedSet.has(option.value) ? "✓" : undefined}
                onPress={() => onToggle(option.value)}
                showChevron={false}
                disabled={option.disabled}
              />
            ))}
          </BaseGroupedList>
        )}
        {sectionFootnote ? <SectionFootnote>{sectionFootnote}</SectionFootnote> : null}
      </section>
      <section className="grid gap-2">
        <SectionHeader title="적용" />
        <BaseGroupedList ariaLabel="다중 선택 적용">
          <NavigationRow label="적용 후 돌아가기" onPress={onApply} description="선택값을 바로 반영합니다." />
        </BaseGroupedList>
        <SectionFootnote>적용을 누르면 이전 화면에 즉시 반영됩니다.</SectionFootnote>
      </section>
    </SelectionLayout>
  );
}

export function PickerSelectionScreen({
  title,
  sectionTitle = "값",
  sectionFootnote,
  inputLabel,
  inputType,
  value,
  onValueChange,
  onApply,
  min,
  max,
  step,
  applyLabel = "적용 후 돌아가기",
  applyDescription = "입력값을 저장하고 이전 화면으로 돌아갑니다.",
  ariaLabel = "입력 값 선택",
}: PickerSelectionScreenProps) {
  void title;
  return (
    <SelectionLayout>
      <section className="grid gap-2">
        <SectionHeader title={sectionTitle} />
        <BaseGroupedList ariaLabel={ariaLabel}>
          <li>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className="ui-card-label">{inputLabel}</span>
              <input
                className="rounded-lg border px-3 py-2"
                type={inputType}
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onValueChange(event.target.value)}
              />
            </div>
          </li>
        </BaseGroupedList>
        {sectionFootnote ? <SectionFootnote>{sectionFootnote}</SectionFootnote> : null}
      </section>
      <section className="grid gap-2">
        <SectionHeader title="적용" />
        <BaseGroupedList ariaLabel="입력 값 적용">
          <NavigationRow label={applyLabel} description={applyDescription} onPress={onApply} />
        </BaseGroupedList>
        <SectionFootnote>적용을 누르면 이전 화면에 즉시 반영됩니다.</SectionFootnote>
      </section>
    </SelectionLayout>
  );
}

export type { SelectionOption };
