import type { SettingsSearchEntry } from "./settings-search-index";

export type SettingsSearchMatch = {
  entry: SettingsSearchEntry;
  score: number;
  matchedKeywords: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function splitSearchTokens(query: string) {
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean);
}

function scoreToken(token: string, entry: SettingsSearchEntry) {
  const title = normalize(entry.title);
  const section = normalize(entry.section);
  const path = normalize(entry.path);
  const key = normalize(entry.key);
  const description = normalize(entry.description ?? "");
  const keywords = entry.keywords.map(normalize);

  let score = 0;
  let matched = false;

  if (title.startsWith(token)) {
    score += 14;
    matched = true;
  } else if (title.includes(token)) {
    score += 10;
    matched = true;
  }

  if (section.includes(token)) {
    score += 6;
    matched = true;
  }

  if (description.includes(token)) {
    score += 5;
    matched = true;
  }

  if (path.includes(token)) {
    score += 4;
    matched = true;
  }

  if (key.includes(token)) {
    score += 3;
    matched = true;
  }

  const matchedKeywords = keywords.filter((keyword) => keyword.includes(token));
  if (matchedKeywords.length > 0) {
    score += 7 + matchedKeywords.length;
    matched = true;
  }

  return {
    matched,
    score,
    matchedKeywords,
  };
}

export function searchSettingsIndex(index: SettingsSearchEntry[], query: string, limit = 20) {
  const tokens = splitSearchTokens(query);
  if (tokens.length === 0) return [] satisfies SettingsSearchMatch[];

  const matches: SettingsSearchMatch[] = [];

  for (const entry of index) {
    let score = 0;
    let allMatched = true;
    const matchedKeywords = new Set<string>();

    for (const token of tokens) {
      const tokenResult = scoreToken(token, entry);
      if (!tokenResult.matched) {
        allMatched = false;
        break;
      }
      score += tokenResult.score;
      for (const keyword of tokenResult.matchedKeywords) {
        matchedKeywords.add(keyword);
      }
    }

    if (!allMatched) continue;

    score += Math.max(0, 5 - tokens.length);

    matches.push({
      entry,
      score,
      matchedKeywords: Array.from(matchedKeywords),
    });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.title.localeCompare(b.entry.title, "ko");
  });

  return matches.slice(0, Math.max(1, limit));
}
