"use client";

import { useMemo, useState } from "react";
import { toSettingsDeepLinkHref } from "@/lib/settings/settings-deeplink";
import type { SettingsSearchEntry } from "@/lib/settings/settings-search-index";
import { searchSettingsIndex, splitSearchTokens } from "@/lib/settings/settings-search";
import { BaseGroupedList, InfoRow, NavigationRow, RowIcon, SectionFootnote, SectionHeader } from "./settings-list";
import styles from "./settings-search.module.css";

type SettingsSearchPanelProps = {
  index: SettingsSearchEntry[];
};

function sectionIcon(section: string) {
  switch (section) {
    case "훈련":
      return { symbol: "TR", tone: "blue" as const };
    case "프로그램":
      return { symbol: "PL", tone: "green" as const };
    case "분석":
      return { symbol: "ST", tone: "tint" as const };
    default:
      return { symbol: "SE", tone: "neutral" as const };
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return text;

  const unique = Array.from(new Set(tokens.filter(Boolean)));
  if (unique.length === 0) return text;

  const regex = new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(regex);

  if (parts.length <= 1) return text;

  return (
    <>
      {parts.map((part, index) => {
        const normalized = part.toLowerCase();
        const matched = unique.some((token) => token.toLowerCase() === normalized);
        if (!matched) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <mark key={`${part}-${index}`} className={styles.highlight}>
            {part}
          </mark>
        );
      })}
    </>
  );
}

function resultDescription(entry: SettingsSearchEntry, matchedKeywords: string[], tokens: string[]) {
  const keywordText = matchedKeywords.slice(0, 3).join(" · ");
  const baseText = entry.description ?? `경로: ${entry.path}`;
  if (!keywordText) return <HighlightText text={baseText} tokens={tokens} />;
  return (
    <>
      <HighlightText text={baseText} tokens={tokens} />
      {" · "}
      <HighlightText text={keywordText} tokens={tokens} />
    </>
  );
}

export function SettingsSearchPanel({ index }: SettingsSearchPanelProps) {
  const [query, setQuery] = useState("");
  const tokens = useMemo(() => splitSearchTokens(query), [query]);
  const results = useMemo(() => searchSettingsIndex(index, query, 30), [index, query]);
  const hasQuery = tokens.length > 0;

  return (
    <section className={styles.searchBlock}>
      <SectionHeader title="검색" />
      <div className={styles.searchBar}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        </span>
        <input
          type="search"
          inputMode="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="설정 검색"
          aria-label="설정 검색"
        />
        {hasQuery ? (
          <button
            type="button"
            className={styles.clearButton}
            aria-label="검색어 지우기"
            onClick={() => setQuery("")}
          >
            ×
          </button>
        ) : null}
      </div>

      {!hasQuery ? (
        <SectionFootnote>설정 이름이나 기능 키워드로 검색하세요.</SectionFootnote>
      ) : (
        <>
          <SectionHeader title={`검색 결과 ${results.length}개`} />
          {results.length > 0 ? (
            <BaseGroupedList ariaLabel="설정 검색 결과">
              {results.map((result) => {
                const icon = sectionIcon(result.entry.section);
                return (
                  <NavigationRow
                    key={result.entry.key}
                    href={toSettingsDeepLinkHref({ key: result.entry.key, source: "search" })}
                    label={<HighlightText text={result.entry.title} tokens={tokens} />}
                    subtitle={result.entry.section}
                    description={resultDescription(result.entry, result.matchedKeywords, tokens)}
                    leading={<RowIcon symbol={icon.symbol} tone={icon.tone} />}
                  />
                );
              })}
            </BaseGroupedList>
          ) : (
            <BaseGroupedList ariaLabel="설정 검색 결과 없음">
              <InfoRow
                label="검색 결과 없음"
                description={`"${query.trim()}"와 일치하는 설정이 없습니다.`}
                tone="neutral"
                leading={<RowIcon symbol="NO" tone="neutral" />}
              />
            </BaseGroupedList>
          )}
          <SectionFootnote>결과를 탭하면 해당 설정 화면으로 이동합니다.</SectionFootnote>
        </>
      )}
    </section>
  );
}
