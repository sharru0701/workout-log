"use client";

import type { CSSProperties, ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  getProgramDetailInfo,
  type ProgramListItem,
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
  초급: 2,
  중급: 3,
  고급: 4,
  일반: 3,
};

const MODULE_NAMES: Record<string, string> = {
  SQUAT: "스쿼트",
  BENCH: "벤치프레스",
  DEADLIFT: "데드리프트",
  OHP: "오버헤드 프레스",
  PULL: "풀업 / 로우",
};

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

function buildArchItems(item: ProgramListItem): ArchItem[] {
  const info = getProgramDetailInfo(item.template);
  const def = item.template.latestVersion?.definition as Record<string, unknown> | undefined;
  const kind = def?.kind as string | undefined;

  const items: ArchItem[] = [];

  // 1. 방식 (progression method)
  const typeStat = info.stats.find((s) => s.label === "방식");
  items.push({
    icon: "equalizer",
    title: "진행 방식",
    desc:
      typeStat?.value === "자동 진행"
        ? "알고리즘 기반 자동 중량 산출 및 세트 진행"
        : "고정 세션 기반 자유로운 중량 설정",
  });

  // 2. 빈도/주기
  const freqStat = info.stats.find((s) => s.label === "주간 빈도");
  const cycleStat = info.stats.find((s) => s.label === "사이클");
  items.push({
    icon: "event_repeat",
    title: "훈련 일정",
    desc: [freqStat?.value, cycleStat?.value].filter(Boolean).join(" · ") || "주간 훈련 일정 기반",
  });

  // 3. 훈련 구성 (modules or sessions)
  if (info.modules && info.modules.length > 0) {
    const moduleNames = info.modules.map((m) => MODULE_NAMES[m] ?? m).join(", ");
    items.push({
      icon: "fitness_center",
      title: "훈련 모듈",
      desc: moduleNames,
    });
  } else if (info.sessions && info.sessions.length > 0) {
    items.push({
      icon: "view_agenda",
      title: "세션 구성",
      desc: `${info.sessions.length}개 세션 · ${info.sessions.reduce((acc, s) => acc + s.exercises.length, 0)}개 종목`,
    });
  } else {
    items.push({
      icon: "swap_horiz",
      title: "종목 구성",
      desc: "목적에 맞는 종목으로 구성된 세션",
    });
  }

  // 4. 강도 기준
  const diffStat = info.stats.find((s) => s.label === "난이도");
  const hasProgression = Boolean(info.progressionNote);
  items.push({
    icon: "speed",
    title: "강도 기준",
    desc: hasProgression
      ? `${diffStat?.value ?? "표준"} 수준 · ${info.progressionNote}`
      : `${diffStat?.value ?? "표준"} 수준 난이도의 프로그램`,
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
  if (!item) return null;

  const info = getProgramDetailInfo(item.template);
  const tags = Array.isArray(item.template.tags) ? item.template.tags : [];
  const isCustom = item.source === "CUSTOM";
  const programName = formatName(item.template.name);

  // ── Bento stats ──
  const cycleStat = info.stats.find((s) => s.label === "사이클");
  const frequencyStat = info.stats.find((s) => s.label === "주간 빈도");
  const difficultyStat = info.stats.find((s) => s.label === "난이도");
  const difficultyLevel = difficultyStat?.value ?? "일반";

  // ── Level badge metadata ──
  const levelBadge = (() => {
    if (difficultyLevel === "초급") return { label: "BEGINNER", color: "var(--color-info)" };
    if (difficultyLevel === "중급") return { label: "INTERMEDIATE", color: "var(--color-primary)" };
    if (difficultyLevel === "고급") return { label: "ADVANCED", color: "var(--color-warning)" };
    if (isCustom) return { label: "CUSTOM", color: "var(--color-info)" };
    return { label: "STANDARD", color: "var(--color-primary)" };
  })();

  // ── Architecture items ──
  const archItems = buildArchItems(item);

  // ── Technical logbook rows (remaining stats) ──
  const logbookStats = info.stats.filter((s) => !["난이도"].includes(s.label));

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
        이 프로그램으로 시작하기
      </PrimaryButton>
      <PrimaryButton type="button" variant="secondary" fullWidth onClick={onCustomize}>
        커스터마이징해서 사용하기
      </PrimaryButton>
      {isCustom && onDelete && (
        <PrimaryButton type="button" variant="danger" fullWidth disabled={saving} onClick={onDelete}>
          커스텀 프로그램 삭제
        </PrimaryButton>
      )}
    </div>
  );

  return (
    <BottomSheet
      open={open}
      title="프로그램 상세"
      onClose={onClose}
      closeLabel="닫기"
      header={header}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>

        {/* ── Bento Stats Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)" }}>
          <StatBentoCell
            icon="calendar_today"
            value={cycleStat?.value ?? "-"}
            label="사이클"
          />
          <StatBentoCell
            icon="event_repeat"
            value={
              frequencyStat
                ? frequencyStat.value.replace("주 ", "").replace("회", "")
                : "-"
            }
            label="Days/Wk"
          />
          <StatBentoCell label="강도">
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
        {item.template.description && (
          <div>
            <span style={sectionEyebrow}>프로그램 소개</span>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {item.template.description}
            </p>
          </div>
        )}

        {/* ── Program Architecture ── */}
        <div>
          <span style={sectionEyebrow}>프로그램 구성</span>
          <ArchitectureGrid items={archItems} />
        </div>

        {/* ── Session Breakdown (when available) ── */}
        {hasSessions && info.sessions && (
          <div>
            <span style={sectionEyebrow}>세션 구성</span>
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
                      세션 {session.key}
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
              Technical Logbook
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
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>진행 설정</span>
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
