"use client";

import { formatProgramDisplayName } from "@/features/program-store/model/view";
import {
  getProgramDetailInfo,
  type ProgramListItem,
} from "@/lib/program-store/model";

function tagLabelClass(tag: string): string {
  const normalized = tag.toLowerCase().trim();
  if (["manual", "fixed", "custom"].some((keyword) => normalized.includes(keyword))) {
    return "label label-tag-manual label-sm";
  }
  if (
    ["beginner", "novice", "starter", "입문", "초보"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "label label-tag-beginner label-sm";
  }
  if (
    ["amrap", "top-set", "topset", "top set", "rpe", "rir"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return normalized.includes("amrap")
      ? "label label-tag-amrap label-sm"
      : "label label-tag-top-set label-sm";
  }
  if (
    ["strength", "power", "hypertrophy", "근력", "파워", "근비대"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "label label-tag-session label-sm";
  }
  if (
    ["linear", "progression", "wave", "periodization", "선형", "주기화"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "label label-tag-progression label-sm";
  }
  if (
    ["base", "variant", "template", "library", "operator"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "label label-tag-identity label-sm";
  }
  return "label label-tag-custom label-sm";
}

function programCardBadge(item: ProgramListItem, locale: "ko" | "en") {
  const tags = (item.template.tags ?? []).map((tag) => tag.toLowerCase());
  const isBeginnerProgram = tags.some((tag) =>
    ["novice", "beginner", "입문", "초보"].includes(tag),
  );

  if (item.source === "CUSTOM") {
    return {
      label: locale === "ko" ? "커스텀" : "Custom",
      style: {
        background: "color-mix(in srgb, var(--color-secondary) 15%, transparent)",
        color: "var(--color-secondary)",
        border:
          "1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)",
      },
    };
  }

  if (isBeginnerProgram) {
    return {
      label: locale === "ko" ? "입문 추천" : "Beginner Pick",
      style: {
        background: "color-mix(in srgb, var(--color-tertiary) 15%, transparent)",
        color: "var(--color-tertiary)",
        border:
          "1px solid color-mix(in srgb, var(--color-tertiary) 20%, transparent)",
      },
    };
  }

  return {
    label: locale === "ko" ? "공식" : "Official",
    style: {
      background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
      color: "var(--color-primary)",
      border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
    },
  };
}

type ProgramListCardProps = {
  item: ProgramListItem;
  locale: "ko" | "en";
  onPress: () => void;
};

export function ProgramListCard({
  item,
  locale,
  onPress,
}: ProgramListCardProps) {
  const info = getProgramDetailInfo(item.template, locale);
  const tags = Array.isArray(item.template.tags) ? item.template.tags : [];
  const isMarket = item.source === "MARKET";
  const badge = programCardBadge(item, locale);

  const difficultyStat = info.stats.find((stat) => stat.key === "difficulty");
  const frequencyStat = info.stats.find((stat) => stat.key === "frequency");
  const cycleStat = info.stats.find((stat) => stat.key === "cycle");
  const splitStat = info.stats.find((stat) => stat.key === "split");
  const periodStat = info.stats.find((stat) => stat.key === "duration");

  const levelLabel =
    difficultyStat?.value ?? (locale === "ko" ? "일반" : "Standard");
  const frequencyLabel = frequencyStat?.value ?? splitStat?.value ?? null;
  const durationLabel = cycleStat?.value ?? periodStat?.value ?? null;

  const intensityMap: Record<string, number> = {
    Beginner: 2,
    Intermediate: 3,
    Advanced: 4,
    Standard: 3,
    초급: 2,
    중급: 3,
    고급: 4,
    일반: 3,
  };
  const intensityFill = intensityMap[levelLabel] ?? 3;

  const metaItems = [
    durationLabel
      ? {
          icon: "calendar_today",
          label: locale === "ko" ? "기간" : "Duration",
          value: durationLabel,
        }
      : null,
    frequencyLabel
      ? {
          icon: "event_repeat",
          label: locale === "ko" ? "빈도" : "Frequency",
          value: frequencyLabel,
        }
      : null,
    {
      icon: "leaderboard",
      label: locale === "ko" ? "난이도" : "Difficulty",
      value: levelLabel,
    },
  ].filter(
    (meta): meta is { icon: string; label: string; value: string } => meta !== null,
  );

  const badgeLabelStyle: React.CSSProperties = {
    fontFamily: "var(--font-label-family)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 4,
    display: "inline-block",
    ...badge.style,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onPress();
      }}
      style={{
        background: "var(--color-surface-container-low)",
        borderRadius: 16,
        padding: "var(--space-lg)",
        cursor: "pointer",
        marginBottom: "var(--space-md)",
        outline: "none",
      }}
      onMouseEnter={(event) => {
        (event.currentTarget as HTMLDivElement).style.background =
          "var(--color-surface-container)";
      }}
      onMouseLeave={(event) => {
        (event.currentTarget as HTMLDivElement).style.background =
          "var(--color-surface-container-low)";
      }}
      onFocus={(event) => {
        (event.currentTarget as HTMLDivElement).style.background =
          "var(--color-surface-container)";
      }}
      onBlur={(event) => {
        (event.currentTarget as HTMLDivElement).style.background =
          "var(--color-surface-container-low)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-sm)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={badgeLabelStyle}>{badge.label}</span>
          <h2
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.3px",
              color: "var(--text-plan-name)",
              margin: "var(--space-xs) 0 2px",
              lineHeight: 1.2,
            }}
          >
            {formatProgramDisplayName(item.name)}
          </h2>
          {item.subtitle ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
              {item.subtitle}
            </p>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "flex-end",
              flexShrink: 0,
              marginLeft: "var(--space-sm)",
            }}
          >
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className={tagLabelClass(tag)}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {item.description ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            margin: "0 0 var(--space-sm)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.description}
        </p>
      ) : null}

      {metaItems.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-md)",
            marginBottom: "var(--space-md)",
            background: "var(--color-surface-container-lowest)",
            padding: "var(--space-sm) var(--space-md)",
            borderRadius: 10,
          }}
        >
          {metaItems.map((meta) => (
            <div
              key={meta.label}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <span
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-text-subtle)",
                }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "13px",
                  color: "var(--color-text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {meta.icon}
                </span>
                {meta.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
        }}
      >
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--color-text-subtle)",
              display: "block",
              marginBottom: 6,
            }}
          >
            {locale === "ko" ? "강도" : "Intensity"}
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {[1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 9999,
                  background:
                    index <= intensityFill
                      ? "var(--color-primary)"
                      : "var(--color-surface-container-highest)",
                }}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPress();
          }}
          style={{
            background: isMarket
              ? "var(--color-action)"
              : "var(--color-surface-container-highest)",
            color: isMarket ? "#fff" : "var(--color-text)",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontFamily: "var(--font-headline-family)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isMarket
            ? locale === "ko"
              ? "시작하기"
              : "Start"
            : locale === "ko"
              ? "편집"
              : "Edit"}
        </button>
      </div>
    </div>
  );
}
