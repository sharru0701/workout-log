"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { BaseGroupedList, NavigationRow, SectionFootnote, SectionHeader } from "./settings-list";
import { EmptyStateRows } from "./settings-state";
import { SearchInput } from "./search-input";

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
    <div>
      {children}
    </div>
  );
}


export function SingleSelectionScreen({
  title,
  sectionTitle,
  sectionFootnote,
  options,
  selectedValue,
  onSelect,
  searchable = false,
  searchPlaceholder,
  emptyDescription,
  ariaLabel,
}: SingleSelectionScreenProps) {
  const { locale } = useLocale();
  void title;
  const [query, setQuery] = useState("");
  const filtered = useFilteredOptions(options, searchable ? query : "");
  const resolvedSectionTitle = sectionTitle ?? (locale === "ko" ? "옵션" : "Options");
  const resolvedSearchPlaceholder = searchPlaceholder ?? (locale === "ko" ? "항목 검색" : "Search items");
  const resolvedEmptyDescription = emptyDescription ?? (locale === "ko" ? "조건에 맞는 항목이 없습니다." : "No items match your filters.");
  const resolvedAriaLabel = ariaLabel ?? (locale === "ko" ? "단일 선택 옵션" : "Single selection options");

  return (
    <SelectionLayout>
      {searchable ? <SearchInput value={query} onChange={setQuery} placeholder={resolvedSearchPlaceholder} ariaLabel={String(resolvedSearchPlaceholder)} /> : null}
      <section>
        <SectionHeader title={resolvedSectionTitle} />
        {filtered.length === 0 ? (
          <EmptyStateRows when description={resolvedEmptyDescription} />
        ) : (
          <BaseGroupedList ariaLabel={resolvedAriaLabel}>
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
  sectionTitle,
  sectionFootnote,
  options,
  selectedValues,
  onToggle,
  onApply,
  searchable = false,
  searchPlaceholder,
  emptyDescription,
  ariaLabel,
}: MultiSelectionScreenProps) {
  const { locale } = useLocale();
  void title;
  const [query, setQuery] = useState("");
  const filtered = useFilteredOptions(options, searchable ? query : "");
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const resolvedSectionTitle = sectionTitle ?? (locale === "ko" ? "옵션" : "Options");
  const resolvedSearchPlaceholder = searchPlaceholder ?? (locale === "ko" ? "항목 검색" : "Search items");
  const resolvedEmptyDescription = emptyDescription ?? (locale === "ko" ? "조건에 맞는 항목이 없습니다." : "No items match your filters.");
  const resolvedAriaLabel = ariaLabel ?? (locale === "ko" ? "다중 선택 옵션" : "Multi-select options");

  return (
    <SelectionLayout>
      {searchable ? <SearchInput value={query} onChange={setQuery} placeholder={resolvedSearchPlaceholder} ariaLabel={String(resolvedSearchPlaceholder)} /> : null}
      <section>
        <SectionHeader title={resolvedSectionTitle} />
        {filtered.length === 0 ? (
          <EmptyStateRows when description={resolvedEmptyDescription} />
        ) : (
          <BaseGroupedList ariaLabel={resolvedAriaLabel}>
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
      <section>
        <SectionHeader title={locale === "ko" ? "적용" : "Apply"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "다중 선택 적용" : "Apply multi-selection"}>
          <NavigationRow
            label={locale === "ko" ? "적용 후 돌아가기" : "Apply and Go Back"}
            onPress={onApply}
            description={locale === "ko" ? "선택값을 바로 반영합니다." : "Apply the selected values immediately."}
          />
        </BaseGroupedList>
        <SectionFootnote>{locale === "ko" ? "적용을 누르면 이전 화면에 즉시 반영됩니다." : "Applying updates the previous screen immediately."}</SectionFootnote>
      </section>
    </SelectionLayout>
  );
}

export function PickerSelectionScreen({
  title,
  sectionTitle,
  sectionFootnote,
  inputLabel,
  inputType,
  value,
  onValueChange,
  onApply,
  min,
  max,
  step,
  applyLabel,
  applyDescription,
  ariaLabel,
}: PickerSelectionScreenProps) {
  const { locale } = useLocale();
  void title;
  const inputId = useId();
  const resolvedSectionTitle = sectionTitle ?? (locale === "ko" ? "값" : "Value");
  const resolvedApplyLabel = applyLabel ?? (locale === "ko" ? "적용 후 돌아가기" : "Apply and Go Back");
  const resolvedApplyDescription = applyDescription ?? (locale === "ko" ? "입력값을 저장하고 이전 화면으로 돌아갑니다." : "Save the value and return to the previous screen.");
  const resolvedAriaLabel = ariaLabel ?? (locale === "ko" ? "입력 값 선택" : "Value picker");

  return (
    <SelectionLayout>
      <section>
        <SectionHeader title={resolvedSectionTitle} />
        <BaseGroupedList ariaLabel={resolvedAriaLabel}>
          <li>
            <div>
              <label htmlFor={inputId}>
                {inputLabel}
              </label>
              <input
                id={inputId}
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
      <section>
        <SectionHeader title={locale === "ko" ? "적용" : "Apply"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "입력 값 적용" : "Apply value"}>
          <NavigationRow label={resolvedApplyLabel} description={resolvedApplyDescription} onPress={onApply} />
        </BaseGroupedList>
        <SectionFootnote>{locale === "ko" ? "적용을 누르면 이전 화면에 즉시 반영됩니다." : "Applying updates the previous screen immediately."}</SectionFootnote>
      </section>
    </SelectionLayout>
  );
}

export type { SelectionOption };
