"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { PrimaryButton } from "@/shared/ui/primary-button";
import {
  getProgramDescription,
  getProgramDetailInfo,
  type ProgramListItem,
  type ProgramStoreLocale,
  type ProgramSessionDraft,
  type ProgramTemplate,
} from "@/lib/program-store/model";

// ─── Local helpers ────────────────────────────────────────────────────────────

function formatName(name: string): string {
  return String(name)
    .replace(/\s*\(base[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tagLabelClass(tag: string): string {
  const t = tag.toLowerCase().trim();
  if (["manual", "fixed", "custom"].some((k) => t.includes(k))) {
    return "label label-tag-custom label-sm";
  }
  if (["beginner", "novice", "starter", "입문", "초보"].some((k) => t.includes(k))) {
    return "label label-tag-beginner label-sm";
  }
  if (["amrap", "top-set", "topset", "top set", "rpe", "rir"].some((k) => t.includes(k))) {
    return t.includes("amrap") ? "label label-tag-amrap label-sm" : "label label-tag-top-set label-sm";
  }
  if (["strength", "power", "hypertrophy", "근력", "파워", "근비대"].some((k) => t.includes(k))) {
    return "label label-tag-session label-sm";
  }
  if (["linear", "progression", "wave", "periodization", "선형", "주기화"].some((k) => t.includes(k))) {
    return "label label-tag-progression label-sm";
  }
  return "label label-tag-custom label-sm";
}

const INTENSITY_MAP: Record<string, number> = {
  Beginner: 2,
  Intermediate: 3,
  Advanced: 4,
  Standard: 3,
  초급: 2,
  중급: 3,
  고급: 4,
  일반: 3,
};

function moduleName(module: string, locale: ProgramStoreLocale) {
  if (module === "SQUAT") return locale === "ko" ? "스쿼트" : "Squat";
  if (module === "BENCH") return locale === "ko" ? "벤치프레스" : "Bench Press";
  if (module === "DEADLIFT") return locale === "ko" ? "데드리프트" : "Deadlift";
  if (module === "OHP") return locale === "ko" ? "오버헤드 프레스" : "Overhead Press";
  if (module === "PULL") return locale === "ko" ? "풀업 / 로우" : "Pull-Up / Row";
  return module;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntensityBars({ level }: { level: string }) {
  const filled = INTENSITY_MAP[level] ?? 3;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: i <= filled ? 14 : 10,
            borderRadius: 3,
            backgroundColor:
              i <= filled ? "var(--color-warning)" : "var(--color-outline-variant)",
            transition: "background-color 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function StatBentoCell({
  icon,
  value,
  label,
  children,
}: {
  icon?: string;
  value?: string;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-container)",
        borderRadius: 14,
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        textAlign: "center",
      }}
    >
      {icon && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 22, color: "var(--color-primary)", marginBottom: 2 }}
        >
          {icon}
        </span>
      )}
      {children}
      {value && (
        <span
          style={{
            fontFamily: "var(--font-label-family)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--font-label-family)",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-text-muted)",
          marginTop: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

type ArchItem = { icon: string; title: string; desc: string };

function ArchitectureGrid({ items }: { items: ArchItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--space-md)",
      }}
    >
      {items.map((item) => (
        <div key={item.title} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-start" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "var(--color-surface-container)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: "var(--color-primary)" }}
            >
              {item.icon}
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-headline-family)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--color-text)",
                marginBottom: 3,
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {item.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Architecture items builder ───────────────────────────────────────────────

function buildArchItems(item: ProgramListItem, locale: ProgramStoreLocale): ArchItem[] {
  const info = getProgramDetailInfo(item.template, locale);
  const items: ArchItem[] = [];

  const typeStat = info.stats.find((s) => s.key === "type");
  items.push({
    icon: "equalizer",
    title: locale === "ko" ? "진행 방식" : "Progression Mode",
    desc:
      typeStat?.value === (locale === "ko" ? "자동 진행" : "Auto Progression")
        ? locale === "ko"
          ? "알고리즘 기반 자동 중량 산출과 세트 흐름을 따릅니다."
          : "Uses algorithm-driven load targets and progression across the cycle."
        : locale === "ko"
          ? "고정 세션 구조를 바탕으로 중량과 볼륨을 직접 조절합니다."
          : "Keeps sessions fixed so you can control load and volume directly.",
  });

  const freqStat = info.stats.find((s) => s.key === "frequency");
  const cycleStat = info.stats.find((s) => s.key === "cycle");
  items.push({
    icon: "event_repeat",
    title: locale === "ko" ? "훈련 일정" : "Training Rhythm",
    desc:
      [freqStat?.value, cycleStat?.value].filter((value) => value && value !== "-").join(" · ") ||
      (locale === "ko" ? "반복 가능한 주간 훈련 리듬을 중심으로 설계되었습니다." : "Built around a repeatable weekly training rhythm."),
  });

  if (info.modules && info.modules.length > 0) {
    const moduleNames = info.modules.map((m) => moduleName(m, locale)).join(", ");
    items.push({
      icon: "fitness_center",
      title: locale === "ko" ? "훈련 모듈" : "Lift Modules",
      desc: moduleNames,
    });
  } else if (info.sessions && info.sessions.length > 0) {
    items.push({
      icon: "view_agenda",
      title: locale === "ko" ? "세션 구성" : "Session Structure",
      desc:
        locale === "ko"
          ? `${info.sessions.length}개 세션 · ${info.sessions.reduce((acc, s) => acc + s.exercises.length, 0)}개 종목`
          : `${info.sessions.length} sessions · ${info.sessions.reduce((acc, s) => acc + s.exercises.length, 0)} exercises`,
    });
  } else {
    items.push({
      icon: "swap_horiz",
      title: locale === "ko" ? "종목 구성" : "Exercise Mix",
      desc: locale === "ko" ? "목적에 맞는 종목 흐름으로 구성되었습니다." : "Built as a balanced exercise mix around the program goal.",
    });
  }

  const diffStat = info.stats.find((s) => s.key === "difficulty");
  const hasProgression = Boolean(info.progressionNote);
  items.push({
    icon: "speed",
    title: locale === "ko" ? "강도 기준" : "Intensity Profile",
    desc: hasProgression
      ? `${diffStat?.value ?? (locale === "ko" ? "일반" : "Standard")} · ${info.progressionNote}`
      : locale === "ko"
        ? `${diffStat?.value ?? "일반"} 수준 난이도로 설계된 프로그램입니다.`
        : `Built around a ${diffStat?.value ?? "Standard"} training profile.`,
  });

  return items;
}

// ─── Main component ───────────────────────────────────────────────────────────

export type ProgramDetailSheetCustomizeDraft = {
  name: string;
  baseTemplate: ProgramTemplate;
  sessions: ProgramSessionDraft[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  item: ProgramListItem | null;
  saving: boolean;
  onStart: () => void;
  onCustomize: () => void;
  onDelete?: () => void;
};

export function ProgramDetailSheet({
  open,
  onClose,
  item,
  saving,
  onStart,
  onCustomize,
  onDelete,
}: Props) {
  const { locale } = useLocale();
  if (!item) return null;

  const info = getProgramDetailInfo(item.template, locale);
  const programDescription = getProgramDescription(item.template, locale);
  const tags = Array.isArray(item.template.tags) ? item.template.tags : [];
  const isCustom = item.source === "CUSTOM";
  const programName = formatName(item.template.name);

  const cycleStat = info.stats.find((s) => s.key === "cycle");
  const frequencyStat = info.stats.find((s) => s.key === "frequency");
  const difficultyStat = info.stats.find((s) => s.key === "difficulty");
  const difficultyLevel = difficultyStat?.value ?? (locale === "ko" ? "일반" : "Standard");

  // ── Level badge metadata ──
  const levelBadge = (() => {
    if (difficultyLevel === "초급" || difficultyLevel === "Beginner") return { label: "BEGINNER", color: "var(--color-info)" };
    if (difficultyLevel === "중급" || difficultyLevel === "Intermediate") return { label: "INTERMEDIATE", color: "var(--color-primary)" };
    if (difficultyLevel === "고급" || difficultyLevel === "Advanced") return { label: "ADVANCED", color: "var(--color-warning)" };
    if (isCustom) return { label: "CUSTOM", color: "var(--color-info)" };
    return { label: "STANDARD", color: "var(--color-primary)" };
  })();

  // ── Architecture items ──
  const archItems = buildArchItems(item, locale);

  const logbookStats = info.stats.filter((s) => s.key !== "difficulty");

  // ── Session breakdown ──
  const hasSessions = Boolean(info.sessions && info.sessions.length > 0);

  const sectionEyebrow: CSSProperties = {
    fontFamily: "var(--font-label-family)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--color-text-subtle)",
    display: "block",
    marginBottom: "var(--space-sm)",
  };

  // ── Custom header ──
  const header = (
    <div
      style={{
        padding: "var(--space-xs) 0 var(--space-md)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-outline-variant) 18%, transparent)",
        marginBottom: "var(--space-md)",
      }}
    >
      {/* Source badge + tags row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-xs)",
        }}
      >
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className={tagLabelClass(tag)}>
              {tag}
            </span>
          ))}
        </div>
        {/* Level badge */}
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            background: `color-mix(in srgb, ${levelBadge.color} 14%, var(--color-surface-container))`,
            border: `1px solid color-mix(in srgb, ${levelBadge.color} 28%, transparent)`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: levelBadge.color,
            }}
          >
            {levelBadge.label}
          </span>
        </div>
      </div>

      {/* Program name */}
      <h1
        style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.4px",
          color: "var(--color-text)",
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {programName}
      </h1>

      {/* Overflow tags */}
      {tags.length > 3 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "var(--space-xs)" }}>
          {tags.slice(3).map((tag) => (
            <span key={tag} className={tagLabelClass(tag)}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // ── Footer ──
  const footer = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        paddingTop: "var(--space-xs)",
      }}
    >
      <PrimaryButton
        type="button"
        variant="primary"
        fullWidth
        disabled={saving || !item.template.latestVersion}
        onClick={onStart}
      >
        {locale === "ko" ? "이 프로그램으로 시작하기" : "Start This Program"}
      </PrimaryButton>
      <PrimaryButton type="button" variant="secondary" fullWidth onClick={onCustomize}>
        {locale === "ko" ? "커스터마이징해서 사용하기" : "Customize Before Starting"}
      </PrimaryButton>
      {isCustom && onDelete && (
        <PrimaryButton type="button" variant="danger" fullWidth disabled={saving} onClick={onDelete}>
          {locale === "ko" ? "커스텀 프로그램 삭제" : "Delete Custom Program"}
        </PrimaryButton>
      )}
    </div>
  );

  return (
    <BottomSheet
      open={open}
      title={locale === "ko" ? "프로그램 상세" : "Program Details"}
      onClose={onClose}
      closeLabel={locale === "ko" ? "닫기" : "Close"}
      header={header}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>

        {/* ── Bento Stats Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)" }}>
          <StatBentoCell
            icon="calendar_today"
            value={cycleStat?.value ?? "-"}
            label={locale === "ko" ? "사이클" : "Cycle"}
          />
          <StatBentoCell
            icon="event_repeat"
            value={
              frequencyStat
                ? locale === "ko"
                  ? frequencyStat.value.replace("주 ", "").replace("회", "")
                  : frequencyStat.value.replace(" days/wk", "")
                : "-"
            }
            label={locale === "ko" ? "주당 빈도" : "Days/Wk"}
          />
          <StatBentoCell label={locale === "ko" ? "강도" : "Intensity"}>
            <IntensityBars level={difficultyLevel} />
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--color-text)",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {difficultyLevel}
            </span>
          </StatBentoCell>
        </div>

        {/* ── Program Overview ── */}
        {programDescription && (
          <div>
            <span style={sectionEyebrow}>{locale === "ko" ? "프로그램 소개" : "Program Overview"}</span>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {programDescription}
            </p>
          </div>
        )}

        {/* ── Program Architecture ── */}
        <div>
          <span style={sectionEyebrow}>{locale === "ko" ? "프로그램 구성" : "Program Architecture"}</span>
          <ArchitectureGrid items={archItems} />
        </div>

        {/* ── Session Breakdown (when available) ── */}
        {hasSessions && info.sessions && (
          <div>
            <span style={sectionEyebrow}>{locale === "ko" ? "세션 구성" : "Session Breakdown"}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {info.sessions.map((session) => (
                <div
                  key={session.key}
                  style={{
                    border: "1px solid color-mix(in srgb, var(--color-outline-variant) 40%, transparent)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-xs)",
                      padding: "6px var(--space-sm)",
                      background: "var(--color-surface-container-high)",
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--color-outline-variant) 30%, transparent)",
                    }}
                  >
                    <span className="label label-program label-sm">{session.key}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {locale === "ko" ? `세션 ${session.key}` : `Session ${session.key}`}
                    </span>
                  </div>
                  <div style={{ padding: "var(--space-sm)" }}>
                    {session.exercises.map((ex, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "var(--space-sm)",
                          padding: "3px 0",
                          borderBottom:
                            i < session.exercises.length - 1
                              ? "1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)"
                              : "none",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--text-exercise-name)" }}>
                          {ex.name}
                        </span>
                        {ex.setsReps && (
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: "var(--font-label-family)",
                              fontWeight: 600,
                              color: "var(--color-text-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ex.setsReps}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Technical Logbook ── */}
        <div
          style={{
            background: "var(--color-surface-container)",
            borderRadius: 14,
            padding: "var(--space-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-md)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {locale === "ko" ? "프로그램 메타" : "Technical Logbook"}
            </span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: "var(--color-text-subtle)" }}
            >
              info
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {logbookStats.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderBottom:
                    i < logbookStats.length - 1
                      ? "1px solid color-mix(in srgb, var(--color-outline-variant) 25%, transparent)"
                      : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {stat.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-label-family)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {stat.value}
                </span>
              </div>
            ))}
            {info.progressionNote && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingTop: 8,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {locale === "ko" ? "진행 설정" : "Progression"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-label-family)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {info.progressionNote}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </BottomSheet>
  );
}
