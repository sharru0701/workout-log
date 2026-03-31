"use client";

import { useRouter } from "next/navigation";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
} from "@/components/ui/settings-list";
import { useLocale } from "@/components/locale-provider";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

// ─── Row icon — 40×40 rounded-xl box with a filled Material Symbol ──

type IconColor = "text-primary" | "text-on-surface";

function RowIcon({ icon, color = "text-primary" }: { icon: string; color?: IconColor }) {
  const bg =
    color === "text-primary"
      ? "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-container-low))"
      : "var(--color-surface-container)";
  const iconColor =
    color === "text-primary" ? "var(--color-primary)" : "var(--color-text-muted)";

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: iconColor,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
    </div>
  );
}

// ─── Section group ────────────────────────────────────────────

type RowDef = {
  href: string;
  label: string;
  description: string;
  icon: string;
  iconColor?: IconColor;
};

function SettingsSection({ title, rows }: { title: string; rows: RowDef[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-label-family)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          padding: "0 4px",
        }}
      >
        {title}
      </div>
      <BaseGroupedList ariaLabel={`${title} settings`}>
        {rows.map((row) => (
          <NavigationRow
            key={row.href}
            href={row.href}
            label={row.label}
            description={row.description}
            leading={<RowIcon icon={row.icon} color={row.iconColor} />}
          />
        ))}
      </BaseGroupedList>
    </section>
  );
}

// ─── Profile card ─────────────────────────────────────────────

function ProfileCard() {
  const { copy } = useLocale();

  return (
    <section
      style={{
        background: "color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-container-low))",
        borderRadius: 24,
        padding: "20px 20px 18px",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--color-primary-weak)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 30,
              color: "var(--color-primary)",
              fontVariationSettings: "'FILL' 1",
            }}
          >
            person
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "var(--color-text)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {copy.settings.profile.title}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
            {/* Active badge chip */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                fontFamily: "var(--font-label-family)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: "var(--color-primary-weak)",
                color: "var(--color-primary)",
                flexShrink: 0,
              }}
            >
              {copy.settings.profile.active}
            </span>
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: 12,
                color: "var(--color-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {copy.settings.profile.subtitle}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────

export function SettingsHomeContent({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { copy } = useLocale();
  const pullToRefresh = usePullToRefresh({
    onRefresh: () => {
      router.refresh();
    },
  });

  const appPreferenceRows: RowDef[] = [
    {
      href: "/settings/language",
      label: copy.settings.rows.language.label,
      description: copy.settings.rows.language.description,
      icon: "translate",
      iconColor: "text-primary",
    },
    {
      href: "/settings/theme",
      label: copy.settings.rows.theme.label,
      description: copy.settings.rows.theme.description,
      icon: "dark_mode",
      iconColor: "text-primary",
    },
    {
      href: "/settings/ux-thresholds",
      label: copy.settings.rows.uxThresholds.label,
      description: copy.settings.rows.uxThresholds.description,
      icon: "tune",
      iconColor: "text-primary",
    },
  ];

  const dataTrainingRows: RowDef[] = [
    {
      href: "/settings/exercise-management",
      label: copy.settings.rows.exerciseManagement.label,
      description: copy.settings.rows.exerciseManagement.description,
      icon: "fitness_center",
      iconColor: "text-primary",
    },
    {
      href: "/settings/minimum-plate",
      label: copy.settings.rows.minimumPlate.label,
      description: copy.settings.rows.minimumPlate.description,
      icon: "hardware",
    },
    {
      href: "/settings/bodyweight",
      label: copy.settings.rows.bodyweight.label,
      description: copy.settings.rows.bodyweight.description,
      icon: "monitor_weight",
    },
    {
      href: "/settings/save-policy",
      label: copy.settings.rows.savePolicy.label,
      description: copy.settings.rows.savePolicy.description,
      icon: "save",
    },
    {
      href: "/settings/selection-template",
      label: copy.settings.rows.selectionTemplate.label,
      description: copy.settings.rows.selectionTemplate.description,
      icon: "playlist_add_check",
    },
    {
      href: "/settings/data-export",
      label: copy.settings.rows.dataExport.label,
      description: copy.settings.rows.dataExport.description,
      icon: "cloud_upload",
    },
    {
      href: "/settings/data",
      label: copy.settings.rows.dataManagement.label,
      description: copy.settings.rows.dataManagement.description,
      icon: "storage",
    },
  ];

  const systemRows: RowDef[] = [
    {
      href: "/settings/system-stats",
      label: copy.settings.rows.systemStats.label,
      description: copy.settings.rows.systemStats.description,
      icon: "developer_board",
    },
    {
      href: "/settings/link",
      label: copy.settings.rows.deepLinks.label,
      description: copy.settings.rows.deepLinks.description,
      icon: "link",
    },
    {
      href: "/settings/about",
      label: copy.settings.rows.about.label,
      description: `v${process.env.NEXT_PUBLIC_APP_VERSION ?? ""}`,
      icon: "info",
    },
  ];

  return (
    <PullToRefreshShell
      pullToRefresh={pullToRefresh}
      className={className || undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 32 }}>
        {/* ── Profile Card ── */}
        <ProfileCard />

        {/* ── App Preferences ── */}
        <SettingsSection title={copy.settings.sections.preferences} rows={appPreferenceRows} />

        {/* ── Data & Training ── */}
        <SettingsSection title={copy.settings.sections.training} rows={dataTrainingRows} />

        {/* ── System ── */}
        <SettingsSection title={copy.settings.sections.system} rows={systemRows} />

        <SectionFootnote>
          {copy.settings.detailDescription}
        </SectionFootnote>
      </div>
    </PullToRefreshShell>
  );
}
