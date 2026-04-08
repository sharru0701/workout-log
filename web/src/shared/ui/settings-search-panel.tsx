"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { toSettingsDeepLinkHref } from "@/lib/settings/settings-deeplink";
import type { SettingsSearchEntry } from "@/lib/settings/settings-search-index";
import { searchSettingsIndex, splitSearchTokens } from "@/lib/settings/settings-search";
import { BaseGroupedList, InfoRow, NavigationRow, RowIcon, SectionFootnote, SectionHeader } from "./settings-list";
type SettingsSearchPanelProps = {
  index: SettingsSearchEntry[];
};

function sectionIcon(section: string) {
  const normalized = section.trim().toLowerCase();
  switch (normalized) {
    case "훈련":
    case "training":
      return { symbol: "TR", tone: "info" as const };
    case "프로그램":
    case "program":
    case "programs":
      return { symbol: "PL", tone: "success" as const };
    case "분석":
    case "analysis":
    case "analytics":
    case "stats":
      return { symbol: "ST", tone: "surface" as const };
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
          <mark key={`${part}-${index}`}>
            {part}
          </mark>
        );
      })}
    </>
  );
}

function resultDescription(
  entry: SettingsSearchEntry,
  matchedKeywords: string[],
  tokens: string[],
  locale: "ko" | "en",
) {
  const keywordText = matchedKeywords.slice(0, 3).join(" · ");
  const localizedDescription = locale === "ko" ? entry.description : entry.descriptionEn ?? entry.description;
  const baseText = localizedDescription ?? (locale === "ko" ? `경로: ${entry.path}` : `Path: ${entry.path}`);
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
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const tokens = useMemo(() => splitSearchTokens(query), [query]);
  const results = useMemo(() => searchSettingsIndex(index, query, 30), [index, query]);
  const hasQuery = tokens.length > 0;
  const sectionLabel = (section: string) => {
    const normalized = section.trim().toLowerCase();
    if (locale === "ko") {
      switch (normalized) {
        case "training":
          return "훈련";
        case "program":
        case "programs":
          return "프로그램";
        case "analysis":
        case "analytics":
        case "stats":
          return "분석";
        default:
          return section;
      }
    }
    switch (normalized) {
      case "훈련":
      case "training":
        return "Training";
      case "프로그램":
      case "program":
      case "programs":
        return "Programs";
      case "분석":
      case "analysis":
      case "analytics":
      case "stats":
        return "Analysis";
      default:
        return "Settings";
    }
  };

  return (
    <section>
      <SectionHeader title={locale === "ko" ? "검색" : "Search"} />
      <div>
        <span aria-hidden="true">
          <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'wght' 400" }}>search</span>
        </span>
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={locale === "ko" ? "설정 검색" : "Search settings"}
          aria-label={locale === "ko" ? "설정 검색" : "Search settings"}
        />
        {hasQuery ? (
          <button
            type="button"
            aria-label={locale === "ko" ? "검색어 지우기" : "Clear search query"}
            onClick={() => setQuery("")}
          >
            ×
          </button>
        ) : null}
      </div>

      {!hasQuery ? (
        <SectionFootnote>{locale === "ko" ? "설정 이름이나 기능 키워드로 검색하세요." : "Search by setting name or feature keyword."}</SectionFootnote>
      ) : (
        <>
          <SectionHeader title={locale === "ko" ? `검색 결과 ${results.length}개` : `${results.length} Results`} />
          {results.length > 0 ? (
            <BaseGroupedList ariaLabel={locale === "ko" ? "설정 검색 결과" : "Settings search results"}>
              {results.map((result) => {
                const icon = sectionIcon(result.entry.section);
                return (
                  <NavigationRow
                    key={result.entry.key}
                    href={toSettingsDeepLinkHref({ key: result.entry.key, source: "search" })}
                    label={<HighlightText text={locale === "ko" ? result.entry.title : result.entry.titleEn ?? result.entry.title} tokens={tokens} />}
                    subtitle={sectionLabel(result.entry.section)}
                    description={resultDescription(result.entry, result.matchedKeywords, tokens, locale)}
                    leading={<RowIcon symbol={icon.symbol} tone={icon.tone} />}
                  />
                );
              })}
            </BaseGroupedList>
          ) : (
            <BaseGroupedList ariaLabel={locale === "ko" ? "설정 검색 결과 없음" : "No settings search results"}>
              <InfoRow
                label={locale === "ko" ? "검색 결과 없음" : "No results"}
                description={locale === "ko" ? `"${query.trim()}"와 일치하는 설정이 없습니다.` : `No settings match "${query.trim()}".`}
                tone="neutral"
                leading={<RowIcon symbol="NO" tone="neutral" />}
              />
            </BaseGroupedList>
          )}
          <SectionFootnote>{locale === "ko" ? "결과를 탭하면 해당 설정 화면으로 이동합니다." : "Tap a result to open that settings screen."}</SectionFootnote>
        </>
      )}
    </section>
  );
}
