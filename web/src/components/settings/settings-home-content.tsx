"use client";

import { useRouter } from "next/navigation";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
} from "@/components/ui/settings-list";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

// ─── Row icon — 40×40 rounded-lg box with a Material Symbol ──

type IconColor = "text-primary" | "text-on-surface";

function RowIcon({ icon, color = "text-on-surface" }: { icon: string; color?: IconColor }) {
  const iconColor =
    color === "text-primary" ? "var(--color-primary)" : "var(--color-text-muted)";

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "var(--color-surface-container-highest)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: iconColor,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
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
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

// ─── Section definitions ──────────────────────────────────────

const appPreferenceRows: RowDef[] = [
  {
    href: "/settings/theme",
    label: "Appearance",
    description: "Dark Mode / Solarized Light",
    icon: "dark_mode",
    iconColor: "text-primary",
  },
  {
    href: "/settings/ux-thresholds",
    label: "UX Thresholds",
    description: "Animation and interaction thresholds",
    icon: "tune",
    iconColor: "text-primary",
  },
];

const dataTrainingRows: RowDef[] = [
  {
    href: "/settings/exercise-management",
    label: "Exercise Management",
    description: "Browse, add, edit and delete exercises",
    icon: "fitness_center",
    iconColor: "text-primary",
  },
  {
    href: "/settings/minimum-plate",
    label: "Minimum Plate",
    description: "Minimum plate unit per exercise type",
    icon: "hardware",
  },
  {
    href: "/settings/bodyweight",
    label: "Bodyweight",
    description: "Used for bodyweight exercise load calculation",
    icon: "monitor_weight",
  },
  {
    href: "/settings/save-policy",
    label: "Save Policy",
    description: "Auto-save and confirmation behaviour",
    icon: "save",
  },
  {
    href: "/settings/selection-template",
    label: "Selection Template",
    description: "Default set selection pattern",
    icon: "playlist_add_check",
  },
  {
    href: "/settings/data-export",
    label: "Data Export",
    description: "Export all training data",
    icon: "cloud_upload",
  },
  {
    href: "/settings/data",
    label: "Data Management",
    description: "Export · Reset app data",
    icon: "storage",
  },
];

const systemRows: RowDef[] = [
  {
    href: "/settings/system-stats",
    label: "System Stats",
    description: "Migration and UX analytics (admin)",
    icon: "developer_board",
  },
  {
    href: "/settings/link",
    label: "Deep Links",
    description: "Internal deep link tools",
    icon: "link",
  },
  {
    href: "/settings/about",
    label: "About",
    description: `v${process.env.NEXT_PUBLIC_APP_VERSION ?? ""}`,
    icon: "info",
  },
];

// ─── Profile card ─────────────────────────────────────────────

function ProfileCard() {
  return (
    <section
      style={{
        backgroundColor: "var(--color-surface-container-low)",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        borderLeft: "4px solid var(--color-primary)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          backgroundColor: "var(--color-surface-container-highest)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--color-text-muted)" }}>
          person
        </span>
      </div>
      <div>
        <h2
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.3px",
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Athlete
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-primary)",
            }}
          >
            Active
          </span>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: "var(--color-outline-variant)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            Workout Tracker
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────

export function SettingsHomeContent({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pullToRefresh = usePullToRefresh({
    onRefresh: () => {
      router.refresh();
    },
  });

  return (
    <PullToRefreshShell
      pullToRefresh={pullToRefresh}
      className={className || undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 32 }}>
        {/* ── Profile Card ── */}
        <ProfileCard />

        {/* ── App Preferences ── */}
        <SettingsSection title="App Preferences" rows={appPreferenceRows} />

        {/* ── Data & Training ── */}
        <SettingsSection title="Data & Training" rows={dataTrainingRows} />

        {/* ── System ── */}
        <SettingsSection title="System" rows={systemRows} />

        <SectionFootnote>
          All settings take effect immediately. On failure the previous value is restored.
        </SectionFootnote>
      </div>
    </PullToRefreshShell>
  );
}
