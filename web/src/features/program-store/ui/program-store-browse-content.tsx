"use client";

import { SearchInput } from "@/components/ui/search-input";
import {
  EmptyStateRows,
  ErrorStateRows,
  NoticeStateRows,
} from "@/components/ui/settings-state";
import type { ProgramListItem } from "@/lib/program-store/model";
import { ProgramListCard } from "./program-list-card";

type ProgramStoreCopy = {
  eyebrow: string;
  title: string;
  description: string;
  loadError: string;
  notice: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  emptySearch: string;
  emptySearchDescription: string;
};

type CategoryOption = {
  key: string;
  label: string;
};

type ProgramStoreBrowseContentProps = {
  locale: "ko" | "en";
  copy: ProgramStoreCopy;
  error: string | null;
  notice: string | null;
  storeQuery: string;
  categoryFilter: string;
  listItems: ProgramListItem[];
  filteredListItems: ProgramListItem[];
  categoryFilteredItems: ProgramListItem[];
  marketListItems: ProgramListItem[];
  customListItems: ProgramListItem[];
  customProgramCount: number;
  categoryOptions: readonly CategoryOption[];
  isStoreSettled: boolean;
  hasStoreQuery: boolean;
  onRetry: () => void;
  onChangeStoreQuery: (value: string) => void;
  onChangeCategoryFilter: (key: string) => void;
  onSelectItem: (item: ProgramListItem) => void;
  onOpenCreateSheet: () => void;
};

export function ProgramStoreBrowseContent({
  locale,
  copy,
  error,
  notice,
  storeQuery,
  categoryFilter,
  listItems,
  filteredListItems,
  categoryFilteredItems,
  marketListItems,
  customListItems,
  customProgramCount,
  categoryOptions,
  isStoreSettled,
  hasStoreQuery,
  onRetry,
  onChangeStoreQuery,
  onChangeCategoryFilter,
  onSelectItem,
  onOpenCreateSheet,
}: ProgramStoreBrowseContentProps) {
  return (
    <>
      <div
        style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label-family)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-primary)",
            marginBottom: "4px",
          }}
        >
          {copy.eyebrow}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "var(--color-text)",
            margin: "0 0 var(--space-sm)",
          }}
        >
          {copy.title}
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {copy.description}
        </p>
      </div>

      <ErrorStateRows message={error} title={copy.loadError} onRetry={onRetry} />
      <NoticeStateRows message={notice} label={copy.notice} />

      {listItems.length > 0 || hasStoreQuery ? (
        <SearchInput
          value={storeQuery}
          onChange={onChangeStoreQuery}
          placeholder={copy.searchPlaceholder}
          ariaLabel={copy.searchAriaLabel}
        />
      ) : null}

      {listItems.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            overflowX: "auto",
            paddingBottom: "var(--space-xs)",
            marginBottom: "var(--space-md)",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {categoryOptions.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => onChangeCategoryFilter(category.key)}
              style={{
                padding: "8px 20px",
                borderRadius: 9999,
                border:
                  categoryFilter === category.key
                    ? "none"
                    : "1px solid var(--color-border)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                flexShrink: 0,
                background:
                  categoryFilter === category.key
                    ? "var(--color-primary-container)"
                    : "var(--color-surface-container-low)",
                color:
                  categoryFilter === category.key
                    ? "var(--color-on-primary)"
                    : "var(--color-text-muted)",
              }}
            >
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      <EmptyStateRows
        when={isStoreSettled && !error && listItems.length > 0 && filteredListItems.length === 0}
        label={copy.emptySearch}
        description={copy.emptySearchDescription}
      />

      <EmptyStateRows
        when={
          isStoreSettled &&
          !error &&
          filteredListItems.length > 0 &&
          categoryFilteredItems.length === 0
        }
        label={
          locale === "ko"
            ? "해당 카테고리의 프로그램이 없습니다"
            : "No programs in this category"
        }
        description={
          locale === "ko"
            ? "다른 카테고리를 선택하거나 전체를 확인해 보세요."
            : "Try a different category or browse all programs."
        }
      />

      {!hasStoreQuery || marketListItems.length > 0 || (isStoreSettled && listItems.length === 0) ? (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2
              style={{
                fontFamily: "var(--font-headline-family)",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              {locale === "ko" ? "공식 프로그램" : "Official Programs"}
            </h2>
          </div>
          <EmptyStateRows
            when={isStoreSettled && !error && !hasStoreQuery && marketListItems.length === 0}
            label={locale === "ko" ? "표시할 프로그램이 없습니다" : "No programs to show"}
          />
          {marketListItems.length > 0 ? (
            <div>
              {marketListItems.map((item) => (
                <ProgramListCard
                  key={item.key}
                  item={item}
                  locale={locale}
                  onPress={() => onSelectItem(item)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {customListItems.length > 0 || (!hasStoreQuery && customProgramCount > 0) ? (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2
              style={{
                fontFamily: "var(--font-headline-family)",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              {locale === "ko" ? "내 프로그램" : "My Programs"}
            </h2>
          </div>
          <div>
            {customListItems.map((item) => (
              <ProgramListCard
                key={item.key}
                item={item}
                locale={locale}
                onPress={() => onSelectItem(item)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: "var(--space-lg)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <h2
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            {locale === "ko" ? "프로그램 만들기" : "Create Program"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenCreateSheet}
          style={{
            width: "100%",
            background: "var(--color-action)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "var(--space-md)",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.2px" }}>
            {locale === "ko" ? "새 프로그램 만들기" : "Create a New Program"}
          </span>
          <span style={{ fontSize: "12px", opacity: 0.82 }}>
            {locale === "ko"
              ? "기존 프로그램을 바탕으로 시작하거나 직접 새 구조를 만드세요."
              : "Start from an existing program or build a fresh structure from scratch."}
          </span>
        </button>
      </section>
    </>
  );
}
