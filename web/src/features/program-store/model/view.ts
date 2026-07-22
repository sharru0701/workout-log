import {
  getProgramScheduleLabel,
  type ProgramListItem,
} from "@workout/core/program-store/model";
import {
  countSelectedFacets,
  deriveProgramFacets,
  matchesProgramFacets,
  type ProgramFacetSelection,
} from "@workout/core/program-store/facets";

/**
 * 5/3/1 변형 — **슬러그 목록과 표시 문구를 한 자료구조로 둔다.** 배열 순서가 곧 노출 순서다.
 *
 * 전에는 슬러그 목록과 라벨 분기(if 체인)가 따로 있었고, 분기가 모르는 슬러그를 전부
 * 기본(Base)으로 처리했다. 그래서 변형을 하나 더 추가할 때 목록에만 넣고 라벨을 빠뜨리면
 * 목록에 "기본"이 두 개 뜨는데, 타입 에러도 경고도 없었다. 고칠 곳이 한 곳이면 그 실수가 없다.
 */
const WENDLER_531_VARIANTS = [
  {
    slug: "wendler-531",
    ko: { label: "기본", description: "보조 세트 없이 메인 5/3/1 세트만 수행합니다." },
    en: {
      label: "Base",
      description: "Runs the main 5/3/1 sets without additional assistance.",
    },
  },
  {
    slug: "wendler-531-fsl",
    ko: { label: "FSL", description: "첫 작업 세트 중량으로 5×5 보조 세트를 추가합니다." },
    en: {
      label: "FSL",
      description: "Adds 5×5 assistance at the first working-set load.",
    },
  },
  {
    slug: "wendler-531-bbb",
    ko: { label: "BBB", description: "훈련 최대 중량(TM)의 50%로 5×10 보조 세트를 추가합니다." },
    en: {
      label: "BBB",
      description: "Adds 5×10 assistance at 50% of the training max (TM).",
    },
  },
] as const;

export type Wendler531VariantPresentation = { label: string; description: string };

type Wendler531VariantSlug = (typeof WENDLER_531_VARIANTS)[number]["slug"];

export const WENDLER_531_VARIANT_SLUGS: readonly Wendler531VariantSlug[] =
  WENDLER_531_VARIANTS.map((variant) => variant.slug);

export type ProgramStoreListItem = ProgramListItem & {
  variants?: ProgramListItem[];
};

const WENDLER_531_VARIANT_ORDER = new Map<string, number>(
  WENDLER_531_VARIANTS.map((variant, index) => [variant.slug, index]),
);

function isWendler531VariantSlug(slug: string): slug is Wendler531VariantSlug {
  return WENDLER_531_VARIANT_ORDER.has(slug);
}

function isOfficialWendler531Variant(item: ProgramListItem) {
  return (
    item.source === "MARKET" && isWendler531VariantSlug(item.template.slug)
  );
}

function sortWendler531Variants(items: ProgramListItem[]) {
  return [...items].sort(
    (a, b) =>
      (WENDLER_531_VARIANT_ORDER.get(a.template.slug) ?? Number.MAX_SAFE_INTEGER) -
      (WENDLER_531_VARIANT_ORDER.get(b.template.slug) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * 등록되지 않은 슬러그는 **null** — 기본(Base) 문구로 위장시키지 않는다.
 * 호출부가 null을 처리한다(표시 생략). 목록 자체가 이 테이블로 걸러지므로 실제로는 도달하지 않고,
 * 도달한다면 그건 등록을 빠뜨렸다는 신호다.
 */
export function getWendler531VariantPresentation(
  slug: string,
  locale: "ko" | "en",
): Wendler531VariantPresentation | null {
  const variant = WENDLER_531_VARIANTS.find((entry) => entry.slug === slug);
  return variant ? variant[locale] : null;
}

export function groupProgramStoreListItems(
  items: ProgramListItem[],
  locale: "ko" | "en",
): ProgramStoreListItem[] {
  const variants = sortWendler531Variants(
    items.filter(isOfficialWendler531Variant),
  );
  if (variants.length !== WENDLER_531_VARIANT_SLUGS.length) return items;

  const variantIds = new Set(variants.map((variant) => variant.template.id));
  const firstVariantIndex = items.findIndex((item) =>
    variantIds.has(item.template.id),
  );
  const representative = variants[0]!;
  // 등록 안 된 변형은 라벨을 지어내지 않고 부제에서 뺀다(위 테이블이 목록을 거르므로 실제론 없다).
  const variantLabels = variants
    .map((variant) => getWendler531VariantPresentation(variant.template.slug, locale)?.label)
    .filter((label): label is string => Boolean(label));
  const groupedItem: ProgramStoreListItem = {
    ...representative,
    key: "market-family-wendler-531",
    name: "Jim Wendler 5/3/1",
    subtitle:
      locale === "ko"
        ? `${variants.length}가지 방식 · ${variantLabels.join(" / ")}`
        : `${variants.length} variants · ${variantLabels.join(" / ")}`,
    // 세 변형은 주 4회·4주 파형·TM 진행이 같고 보조만 다르다. 다만 BBB만 근비대 성격이 붙어
    // goal facet이 갈리므로(hypertrophy 태그), 근비대로 필터링해 이 카드를 만난 사람이
    // "왜 근력 프로그램이 떴지?" 하지 않도록 어느 변형이 그 볼륨을 담당하는지 설명에 밝힌다.
    description:
      locale === "ko"
        ? "동일한 4주 5/3/1 진행에 보조 운동만 다르게 얹습니다. 기본은 메인 세트만, FSL은 첫 작업 세트 중량으로 5×5, BBB는 TM 50%로 5×10을 더해 근비대 볼륨을 크게 가져갑니다."
        : "The same four-week 5/3/1 progression with different assistance: Base runs the main sets only, FSL adds 5×5 at the first working-set load, and BBB adds 5×10 at 50% of the training max for a much larger hypertrophy stimulus.",
    variants,
  };

  return items.flatMap((item, index) => {
    if (index === firstVariantIndex) return [groupedItem];
    if (variantIds.has(item.template.id)) return [];
    return [item];
  });
}

function programListItemSearchText(
  item: ProgramListItem,
  locale: "ko" | "en",
) {
  const scheduleLabel = getProgramScheduleLabel(item.template, locale);
  const tags = Array.isArray(item.template.tags)
    ? item.template.tags.join(" ")
    : "";
  return normalizeSearchText(
    item.template.slug,
    formatProgramDisplayName(item.name),
    item.subtitle,
    item.description,
    scheduleLabel,
    tags,
  );
}

export function filterProgramListItemsBySearch(
  items: ProgramStoreListItem[],
  query: string,
  locale: "ko" | "en",
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => {
    const searchableItems = item.variants ?? [item];
    return normalizeSearchText(
      programListItemSearchText(item, locale),
      ...searchableItems.map((variant) =>
        programListItemSearchText(variant, locale),
      ),
    ).includes(normalizedQuery);
  });
}

export function resolveProgramStoreSelection(
  item: ProgramStoreListItem,
  query: string,
  locale: "ko" | "en",
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || !item.variants) return item;
  return (
    item.variants.find((variant) =>
      programListItemSearchText(variant, locale).includes(normalizedQuery),
    ) ?? item
  );
}

export function getProgramStoreDetailVariants(
  items: ProgramListItem[],
  item: ProgramListItem | null,
) {
  if (!item || !isOfficialWendler531Variant(item)) return item ? [item] : [];
  const variants = sortWendler531Variants(
    items.filter(isOfficialWendler531Variant),
  );
  return variants.length === WENDLER_531_VARIANT_SLUGS.length
    ? variants
    : [item];
}


export function formatProgramDisplayName(name: string) {
  return String(name)
    .replace(/\s*\(base[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/**
 * A grouped item (the 5/3/1 family) stands for its variants, so it survives the
 * filter when any variant matches — the same rule the search already uses.
 */
export function filterProgramListItemsByFacets(
  items: ProgramStoreListItem[],
  selection: ProgramFacetSelection,
) {
  if (countSelectedFacets(selection) === 0) return items;
  return items.filter((item) =>
    (item.variants ?? [item]).some((entry) =>
      matchesProgramFacets(deriveProgramFacets(entry.template), selection),
    ),
  );
}
