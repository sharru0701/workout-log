"use client";

import dynamic from "next/dynamic";
import { V2Card, V2Chip } from "@/components/v2/primitives";
import { AppTextInput } from "@/components/ui/form-controls";
import {
  EDITABLE_PROGRAM_FACET_KEYS,
  programFacetGroupLabel,
  programFacetValueLabel,
  toggleProgramFacet,
  type ProgramFacetKey,
  type ProgramFacetSelection,
} from "@workout/core/program-store/facets";

const BottomSheet = dynamic(
  () => import("@/components/ui/bottom-sheet").then((mod) => mod.BottomSheet),
  { ssr: false },
);

/** 각 축에서 고를 수 있는 값. facets의 어휘와 같은 순서를 따른다. */
const FACET_OPTIONS: Record<ProgramFacetKey, string[]> = {
  goal: ["strength", "hypertrophy", "endurance"],
  level: ["beginner", "intermediate", "advanced"],
  style: ["linear", "undulating", "block", "adaptive"],
  engine: [],
  frequency: [],
};

export type EditProgramMetaDraft = {
  slug: string;
  name: string;
  description: string;
  facets: ProgramFacetSelection;
};

type Props = {
  locale: "ko" | "en";
  draft: EditProgramMetaDraft | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (patch: Partial<EditProgramMetaDraft>) => void;
};

export function EditProgramMetaSheet({
  locale,
  draft,
  saving,
  error,
  onClose,
  onSave,
  onChange,
}: Props) {
  return (
    <BottomSheet
      open={Boolean(draft)}
      title={locale === "ko" ? "프로그램 정보 편집" : "Edit Program Info"}
      description={
        locale === "ko"
          ? "스토어에 표시되는 이름·소개와 검색 필터에 쓰이는 태그를 정합니다. 운동 구성은 커스터마이징에서 바꿉니다."
          : "Sets the name and blurb shown in the store, plus the tags used by filters. Exercise structure is edited in Customize."
      }
      onClose={onClose}
      closeLabel={locale === "ko" ? "닫기" : "Close"}
      primaryAction={
        draft
          ? {
              ariaLabel: saving
                ? locale === "ko"
                  ? "저장 중"
                  : "Saving"
                : locale === "ko"
                  ? "저장"
                  : "Save",
              onPress: onSave,
              disabled: saving || !draft.name.trim(),
            }
          : null
      }
      footer={null}
    >
      {draft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-5)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-2)" }}>
            <span className="v2-eyebrow" style={{ color: "var(--v2-ink-3)" }}>
              {locale === "ko" ? "이름" : "Name"}
            </span>
            <AppTextInput
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder={locale === "ko" ? "프로그램 이름" : "Program name"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-2)" }}>
            <span className="v2-eyebrow" style={{ color: "var(--v2-ink-3)" }}>
              {locale === "ko" ? "소개" : "Blurb"}
            </span>
            <AppTextInput
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder={
                locale === "ko"
                  ? "이 프로그램이 무엇인지 한두 문장으로"
                  : "One or two sentences about this program"
              }
            />
            <span className="v2-small" style={{ color: "var(--v2-ink-2)" }}>
              {locale === "ko"
                ? "비워두면 스토어에서 소개 없이 표시됩니다."
                : "Leave empty to show no blurb in the store."}
            </span>
          </div>

          <V2Card padding="var(--v2-s-4)">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
                <span className="v2-eyebrow" style={{ color: "var(--v2-ink-3)" }}>
                  {locale === "ko" ? "태그" : "Tags"}
                </span>
                <span className="v2-small" style={{ color: "var(--v2-ink-2)" }}>
                  {locale === "ko"
                    ? "스토어 필터에 쓰입니다. 해당하지 않으면 비워두세요 — 없는 성격을 넣으면 필터 결과가 어긋납니다."
                    : "Used by store filters. Leave an axis empty when it does not apply."}
                </span>
              </div>

              {EDITABLE_PROGRAM_FACET_KEYS.map((key) => (
                <div
                  key={key}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-2)" }}
                >
                  <span className="v2-small" style={{ color: "var(--v2-ink-2)", fontWeight: 700 }}>
                    {programFacetGroupLabel(key, locale)}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--v2-s-2)" }}>
                    {FACET_OPTIONS[key].map((value) => {
                      const active = (draft.facets[key] ?? []).includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            onChange({ facets: toggleProgramFacet(draft.facets, key, value) })
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            minHeight: "var(--v2-s-9)",
                          }}
                        >
                          <V2Chip tone={active ? "accent" : "neutral"}>
                            {programFacetValueLabel(key, value, locale)}
                          </V2Chip>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </V2Card>

          {error ? (
            <p className="v2-small" style={{ margin: 0, color: "var(--v2-c-danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
