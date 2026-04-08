"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type { SearchSelectOption } from "@/components/ui/search-select-sheet";
import { areSearchSelectOptionsEqual } from "@/features/workout-log/ui/prop-equality";
import type { AppCopy } from "@/lib/i18n/messages";

const SearchSelectSheet = dynamic(
  () => import("@/components/ui/search-select-sheet").then((mod) => mod.SearchSelectSheet),
  { ssr: false },
);

type PlanSelectorSheetProps = {
  open: boolean;
  copy: AppCopy["workoutLog"];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  options: SearchSelectOption[];
};

function arePlanSelectorSheetPropsEqual(
  previous: PlanSelectorSheetProps,
  next: PlanSelectorSheetProps,
) {
  return (
    previous.open === next.open &&
    previous.copy === next.copy &&
    previous.query === next.query &&
    previous.onQueryChange === next.onQueryChange &&
    previous.onClose === next.onClose &&
    areSearchSelectOptionsEqual(previous.options, next.options)
  );
}

export const PlanSelectorSheet = memo(function PlanSelectorSheet({
  open,
  copy,
  query,
  onQueryChange,
  onClose,
  options,
}: PlanSelectorSheetProps) {
  return (
    <SearchSelectSheet
      open={open}
      title={copy.planSheetTitle}
      description={copy.planSheetDescription}
      onClose={onClose}
      closeLabel={copy.close}
      query={query}
      placeholder={copy.planSearchPlaceholder}
      onQueryChange={onQueryChange}
      onQuerySubmit={() => {
        const first = options[0];
        if (!first) return;
        first.onSelect();
      }}
      resultsAriaLabel={copy.planSearchResults}
      emptyText={copy.noMatchingPlans}
      options={options}
    />
  );
}, arePlanSelectorSheetPropsEqual);
