"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { APP_ROUTES } from "@/lib/app-routes";
import type { PlanForManage } from "@/server/services/plans/get-plans-for-manage";

type Plan = PlanForManage;
type StrengthBaselineDraft = Record<string, { oneRepMaxKg: number; trainingMaxKg: number }>;

const TARGET_LABELS: Record<string, string> = {
  SQUAT: "Squat",
  BENCH: "Bench",
  DEADLIFT: "Deadlift",
  OHP: "OHP",
  PULL: "Pull",
};

const TARGET_PRIORITY = ["SQUAT", "BENCH", "DEADLIFT", "OHP", "PULL"];
const PRIMARY_LIFTS = ["SQUAT", "BENCH", "DEADLIFT", "OHP"];
const RECENT_THRESHOLD_DAYS = 7;
const IDLE_THRESHOLD_DAYS = 21;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readPositiveNumberMap(value: unknown) {
  const source = toRecord(value);
  const next: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim().toUpperCase();
    const parsed = Number(rawValue);
    if (!key || !Number.isFinite(parsed) || parsed <= 0) continue;
    next[key] = Math.round(parsed * 100) / 100;
  }
  return next;
}

function createStrengthBaselineDraft(params: unknown): StrengthBaselineDraft {
  const source = toRecord(params);
  const oneRepMaxKg = readPositiveNumberMap(source.oneRepMaxKg);
  const trainingMaxKg = readPositiveNumberMap(source.trainingMaxKg);
  const keys = Array.from(new Set([...Object.keys(oneRepMaxKg), ...Object.keys(trainingMaxKg)])).sort();

  const next: StrengthBaselineDraft = {};
  for (const key of keys) {
    next[key] = {
      oneRepMaxKg: oneRepMaxKg[key] ?? 0,
      trainingMaxKg: trainingMaxKg[key] ?? 0,
    };
  }
  return next;
}

function targetLabelFromKey(key: string) {
  if (TARGET_LABELS[key]) return TARGET_LABELS[key];
  if (key.startsWith("EX_")) {
    return key
      .slice(3)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  }
  return key;
}

function shortLiftLabel(key: string) {
  if (key === "SQUAT") return "SQ";
  if (key === "BENCH") return "BP";
  if (key === "DEADLIFT") return "DL";
  if (key === "OHP") return "OHP";
  if (key === "PULL") return "PULL";
  return targetLabelFromKey(key).slice(0, 3).toUpperCase();
}

function formatKg(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function planWithPatchedFields(prevPlan: Plan, updatedPlan: Plan): Plan {
  return {
    ...prevPlan,
    ...updatedPlan,
    baseProgramName: updatedPlan.baseProgramName ?? prevPlan.baseProgramName,
    lastPerformedAt: updatedPlan.lastPerformedAt ?? prevPlan.lastPerformedAt,
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatRelativeDays(days: number | null, locale: "ko" | "en") {
  if (days === null) return null;
  if (days <= 0) return locale === "ko" ? "오늘" : "Today";
  if (days === 1) return locale === "ko" ? "어제" : "Yesterday";
  if (days < 7) return locale === "ko" ? `${days}일 전` : `${days}d ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return locale === "ko" ? `${w}주 전` : `${w}w ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return locale === "ko" ? `${m}개월 전` : `${m}mo ago`;
  }
  const y = Math.floor(days / 365);
  return locale === "ko" ? `${y}년 전` : `${y}y ago`;
}

function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

type LiftCell = { key: string; label: string; valueKg: number; kind: "TM" | "1RM" } | null;

function readPrimaryLifts(params: unknown): LiftCell[] {
  const source = toRecord(params);
  const tm = readPositiveNumberMap(source.trainingMaxKg);
  const orm = readPositiveNumberMap(source.oneRepMaxKg);

  return PRIMARY_LIFTS.map((key) => {
    const valueKg = tm[key] ?? orm[key] ?? 0;
    if (valueKg <= 0) return null;
    return {
      key,
      label: shortLiftLabel(key),
      valueKg,
      kind: tm[key] ? ("TM" as const) : ("1RM" as const),
    };
  });
}

type StatusKind = "active" | "idle" | "new";

function planStatus(days: number | null): StatusKind {
  if (days === null) return "new";
  if (days <= RECENT_THRESHOLD_DAYS) return "active";
  if (days >= IDLE_THRESHOLD_DAYS) return "idle";
  return "active";
}

function statusLabel(status: StatusKind, locale: "ko" | "en") {
  if (status === "active") return locale === "ko" ? "활성" : "Active";
  if (status === "idle") return locale === "ko" ? "휴면" : "Idle";
  return locale === "ko" ? "신규" : "New";
}

function PlanCard({
  plan,
  onManage,
  copy,
  locale,
}: {
  plan: Plan;
  onManage: () => void;
  copy: ReturnType<typeof useLocale>["copy"];
  locale: "ko" | "en";
}) {
  const days = daysSince(plan.lastPerformedAt);
  const relText = formatRelativeDays(days, locale);
  const status = planStatus(days);
  const lifts = readPrimaryLifts(plan.params);
  const hasAnyLift = lifts.some((cell) => cell !== null);

  return (
    <article className="plan-card" data-status={status}>
      <div className="plan-card__head">
        <div className="plan-card__head-text">
          {plan.baseProgramName ? (
            <div className="plan-card__program">{plan.baseProgramName}</div>
          ) : null}
          <h3 className="plan-card__name">{plan.name}</h3>
        </div>
        <span className="plan-card__status" data-status={status}>
          <span className="plan-card__status-dot" aria-hidden="true" />
          {statusLabel(status, locale)}
        </span>
      </div>

      <div className="plan-card__meta">
        <span className="material-symbols-outlined" aria-hidden="true">
          schedule
        </span>
        <span>
          {relText
            ? `${copy.plansManage.recentPerformedPrefix} · ${relText}`
            : copy.plansManage.noPerformedHistory}
        </span>
      </div>

      {hasAnyLift ? (
        <div className="plan-card__lifts">
          {lifts.map((cell, idx) => (
            <div
              key={cell?.key ?? `empty-${idx}`}
              className="plan-card__lift"
              data-empty={cell ? "false" : "true"}
            >
              <span className="plan-card__lift-label">
                {cell ? cell.label : shortLiftLabel(PRIMARY_LIFTS[idx])}
              </span>
              <span className="plan-card__lift-value">
                {cell ? `${formatKg(cell.valueKg)}` : "—"}
                {cell ? <span className="plan-card__lift-unit">kg</span> : null}
              </span>
              <span className="plan-card__lift-kind">{cell ? cell.kind : "—"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="plan-card__lifts-empty">
          <span className="material-symbols-outlined" aria-hidden="true">
            tune
          </span>
          <span>
            {locale === "ko"
              ? "1RM/TM 미설정 — 관리에서 입력하면 카드에 표시됩니다."
              : "1RM/TM not set — enter values in Manage to populate this card."}
          </span>
        </div>
      )}

      <div className="plan-card__actions">
        <Link
          href={`${APP_ROUTES.plansHistory}?planId=${encodeURIComponent(plan.id)}`}
          className="plan-card__action plan-card__action--ghost"
          aria-label={`${plan.name} ${copy.plansManage.history}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            history
          </span>
          {copy.plansManage.history}
        </Link>
        <button
          type="button"
          className="plan-card__action plan-card__action--primary"
          onClick={onManage}
          aria-label={`${plan.name} ${copy.plansManage.manage}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            tune
          </span>
          {copy.plansManage.manage}
        </button>
      </div>
    </article>
  );
}

export function PlansOverviewContent({ initialPlans }: { initialPlans: Plan[] }) {
  const { copy, locale } = useLocale();
  const { alert, confirm } = useAppDialog();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [loading, setLoading] = useState(false);
  const [loadKey, setLoadKey] = useState("plans-overview:load:init");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const storeHasLoadedRef = useRef(initialPlans.length > 0);

  const [managePlanId, setManagePlanId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [strengthDraft, setStrengthDraft] = useState<StrengthBaselineDraft>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const managedPlan = useMemo(
    () => plans.find((item) => item.id === managePlanId) ?? null,
    [managePlanId, plans],
  );
  const strengthRows = useMemo(
    () =>
      Object.entries(strengthDraft)
        .map(([key, value]) => ({
          key,
          label: targetLabelFromKey(key),
          oneRepMaxKg: value.oneRepMaxKg,
          trainingMaxKg: value.trainingMaxKg,
        }))
        .sort((a, b) => {
          const ai = TARGET_PRIORITY.indexOf(a.key);
          const bi = TARGET_PRIORITY.indexOf(b.key);
          if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }),
    [strengthDraft],
  );
  const isSettled = useQuerySettled(loadKey, loading);
  const filteredPlans = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return plans;
    return plans.filter((plan) =>
      normalizeSearchText(plan.name, plan.baseProgramName, plan.type).includes(normalizedQuery),
    );
  }, [plans, searchQuery]);

  const summary = useMemo(() => {
    let active = 0;
    let mostRecentDays: number | null = null;
    for (const plan of plans) {
      const days = daysSince(plan.lastPerformedAt);
      if (days !== null && days <= RECENT_THRESHOLD_DAYS) active += 1;
      if (days !== null && (mostRecentDays === null || days < mostRecentDays)) {
        mostRecentDays = days;
      }
    }
    return {
      total: plans.length,
      active,
      mostRecent: mostRecentDays,
    };
  }, [plans]);

  const loadPlans = useCallback(async (options?: { isRefresh?: boolean }) => {
    try {
      if (!storeHasLoadedRef.current && !options?.isRefresh) setLoading(true);
      setLoadKey(`plans-overview:load:${Date.now()}`);
      setError(null);
      const res = await apiGet<{ items: Plan[] }>("/api/plans");
      storeHasLoadedRef.current = true;
      setPlans(res.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? (locale === "ko" ? "플랜 목록을 불러오지 못했습니다." : "Could not load plans."));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (refreshTick > 0) {
      void loadPlans({ isRefresh: true });
    }
  }, [loadPlans, refreshTick]);

  useEffect(() => {
    if (!managePlanId) return;
    if (plans.some((item) => item.id === managePlanId)) return;
    setManagePlanId("");
    setSaving(false);
    setDeleting(false);
  }, [managePlanId, plans]);

  function openManageSheet(plan: Plan) {
    setError(null);
    setNameDraft(plan.name);
    setStrengthDraft(createStrengthBaselineDraft(plan.params));
    setManagePlanId(plan.id);
  }

  async function savePlanChanges() {
    if (!managedPlan) return;
    const nextName = nameDraft.trim();
    if (!nextName) {
      await alert({
        title: locale === "ko" ? "입력 확인 필요" : "Input required",
        message: locale === "ko" ? "플랜 이름은 비워둘 수 없습니다." : "Plan name cannot be empty.",
        buttonText: locale === "ko" ? "확인" : "OK",
        tone: "danger",
      });
      return;
    }

    const oneRepMaxKg: Record<string, number> = {};
    const trainingMaxKg: Record<string, number> = {};
    for (const row of strengthRows) {
      if (row.oneRepMaxKg <= 0 && row.trainingMaxKg <= 0) {
        await alert({
          title: locale === "ko" ? "입력 확인 필요" : "Input required",
          message:
            locale === "ko"
              ? `${row.label}의 1RM 또는 TM을 kg 기준으로 입력하세요.`
              : `Enter the 1RM or TM for ${row.label} in kg.`,
          buttonText: locale === "ko" ? "확인" : "OK",
          tone: "danger",
        });
        return;
      }
      if (row.oneRepMaxKg > 0) oneRepMaxKg[row.key] = row.oneRepMaxKg;
      if (row.trainingMaxKg > 0) trainingMaxKg[row.key] = row.trainingMaxKg;
    }

    const prevPlan = managedPlan;
    const nextParams = {
      ...toRecord(managedPlan.params),
      oneRepMaxKg,
      trainingMaxKg,
    };

    try {
      setSaving(true);
      setError(null);

      setPlans((prev) =>
        prev.map((item) =>
          item.id === managedPlan.id ? { ...item, name: nextName, params: nextParams } : item,
        ),
      );

      const res = await apiPatch<{ plan: Plan }>(`/api/plans/${encodeURIComponent(managedPlan.id)}`, {
        name: nextName,
        params: nextParams,
      });
      setPlans((prev) =>
        prev.map((item) =>
          item.id === managedPlan.id ? planWithPatchedFields(item, res.plan) : item,
        ),
      );
      setManagePlanId("");
      await alert({
        title: locale === "ko" ? "수정 완료" : "Saved",
        message:
          locale === "ko"
            ? `플랜 정보가 변경되었습니다.\n${res.plan.name}`
            : `Plan updated.\n${res.plan.name}`,
        buttonText: locale === "ko" ? "확인" : "OK",
      });
    } catch (e: any) {
      if (managedPlan) {
        setPlans((prev) => prev.map((item) => (item.id === managedPlan.id ? prevPlan : item)));
      }
      const message = e?.message ?? (locale === "ko" ? "플랜 정보 수정에 실패했습니다." : "Could not update plan.");
      setError(message);
      await alert({
        title: locale === "ko" ? "수정 실패" : "Save failed",
        message,
        buttonText: locale === "ko" ? "확인" : "OK",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!managedPlan) return;
    const ok = await confirm({
      title: locale === "ko" ? "플랜 삭제" : "Delete Plan",
      message:
        locale === "ko"
          ? `'${managedPlan.name}' 플랜을 삭제하시겠습니까?\n생성된 세션/진행 상태가 함께 정리됩니다.`
          : `Delete the plan '${managedPlan.name}'?\nGenerated sessions and progression state will be cleaned up.`,
      confirmText: locale === "ko" ? "삭제" : "Delete",
      cancelText: locale === "ko" ? "취소" : "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setDeleting(true);
      setError(null);

      const targetId = managedPlan.id;
      setManagePlanId("");
      setPlans((prev) => prev.filter((item) => item.id !== targetId));

      await apiDelete<{ deleted: boolean; planId: string }>(
        `/api/plans/${encodeURIComponent(targetId)}`,
      );
      await alert({
        title: locale === "ko" ? "삭제 완료" : "Deleted",
        message:
          locale === "ko"
            ? `플랜이 삭제되었습니다.\n${managedPlan.name}`
            : `Plan deleted.\n${managedPlan.name}`,
        buttonText: locale === "ko" ? "확인" : "OK",
      });
    } catch (e: any) {
      void loadPlans({ isRefresh: true });
      const message = e?.message ?? (locale === "ko" ? "플랜 삭제에 실패했습니다." : "Could not delete plan.");
      setError(message);
      await alert({
        title: locale === "ko" ? "삭제 실패" : "Delete failed",
        message,
        buttonText: locale === "ko" ? "확인" : "OK",
        tone: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  const summaryTotalLabel = locale === "ko" ? "전체 플랜" : "Total";
  const summaryActiveLabel = locale === "ko" ? "최근 7일 활성" : "Active 7d";
  const summaryRecentLabel = locale === "ko" ? "마지막 운동" : "Last Workout";
  const summaryRecentValue = summary.mostRecent === null
    ? (locale === "ko" ? "—" : "—")
    : (formatRelativeDays(summary.mostRecent, locale) ?? "—");
  const addLabel = locale === "ko" ? "프로그램 추가" : "Add Program";

  return (
    <>
      <header className="plans-overview__header">
        <div className="plans-overview__title-block">
          <h1 className="plans-overview__title">{copy.plans.title}</h1>
          <p className="plans-overview__subtitle">{copy.plans.description}</p>
        </div>
        <Link href={APP_ROUTES.programStore} className="plans-overview__add">
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
          {addLabel}
        </Link>
      </header>

      <div className="plans-overview__summary" role="list">
        <div className="plans-overview__summary-cell" role="listitem">
          <div className="plans-overview__summary-label">{summaryTotalLabel}</div>
          <div className="plans-overview__summary-value">{summary.total}</div>
        </div>
        <div className="plans-overview__summary-cell" role="listitem">
          <div className="plans-overview__summary-label">{summaryActiveLabel}</div>
          <div className="plans-overview__summary-value">
            {summary.active}
            <span className="plans-overview__summary-suffix">/ {summary.total}</span>
          </div>
        </div>
        <div className="plans-overview__summary-cell" role="listitem">
          <div className="plans-overview__summary-label">{summaryRecentLabel}</div>
          <div className="plans-overview__summary-value plans-overview__summary-value--text">
            {summaryRecentValue}
          </div>
        </div>
      </div>

      <section style={{ marginTop: "var(--space-md)" }}>
        {plans.length > 0 || searchQuery.trim().length > 0 ? (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={copy.plansManage.searchPlaceholder}
              ariaLabel={copy.plansManage.searchAriaLabel}
            />
          </div>
        ) : null}

        <LoadingStateRows active={loading} label={locale === "ko" ? "플랜 목록 로딩 중" : "Loading plans"} />
        <ErrorStateRows
          message={error}
          title={copy.plansManage.loadError}
          onRetry={() => {
            void loadPlans();
          }}
        />
        <EmptyStateRows
          when={isSettled && !error && plans.length === 0}
          label={copy.plansManage.noPlans}
          description={copy.plansManage.noPlansDescription}
        />
        <EmptyStateRows
          when={isSettled && !error && plans.length > 0 && filteredPlans.length === 0}
          label={copy.plansManage.noResults}
          description={copy.plansManage.noResultsDescription}
        />

        {filteredPlans.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {filteredPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                copy={copy}
                locale={locale}
                onManage={() => openManageSheet(plan)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(managePlanId)}
        onClose={() => {
          if (saving || deleting) return;
          setManagePlanId("");
        }}
        title={copy.plansManage.detailTitle}
        description={copy.plansManage.detailDescription}
        closeLabel={copy.plansManage.close}
      >
        {managedPlan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div className="plan-sheet__meta">
              <div className="plan-sheet__meta-cell">
                <div className="plan-sheet__meta-label">{copy.plansManage.baseProgram}</div>
                <div className="plan-sheet__meta-value">{managedPlan.baseProgramName ?? "-"}</div>
              </div>
              <div className="plan-sheet__meta-cell">
                <div className="plan-sheet__meta-label">{copy.plansManage.lastPerformedAt}</div>
                <div className="plan-sheet__meta-value">
                  {managedPlan.lastPerformedAt
                    ? formatDateTime(managedPlan.lastPerformedAt)
                    : copy.plansManage.noRecord}
                </div>
              </div>
            </div>

            <label className="plan-sheet__field">
              <span className="plan-sheet__field-label">{copy.plansManage.planName}</span>
              <AppTextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={copy.plansManage.planNamePlaceholder}
              />
            </label>

            <div className="plan-sheet__field">
              <span className="plan-sheet__field-label">{copy.plansManage.strengthBaselines}</span>
              {strengthRows.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {strengthRows.map((row) => (
                    <div key={row.key} className="tm-edit-row">
                      <strong className="tm-edit-row__label">{row.label}</strong>
                      <div className="tm-edit-row__field">
                        <span className="tm-edit-row__field-label">{copy.plansManage.oneRepMax}</span>
                        <NumberPickerField
                          label={`${row.label} ${copy.plansManage.oneRepMax}`}
                          value={row.oneRepMaxKg}
                          min={0}
                          max={500}
                          step={0.5}
                          unit="kg"
                          formatValue={formatKg}
                          onChange={(value) => {
                            setStrengthDraft((prev) => ({
                              ...prev,
                              [row.key]: {
                                ...(prev[row.key] ?? { oneRepMaxKg: 0, trainingMaxKg: 0 }),
                                oneRepMaxKg: value,
                              },
                            }));
                          }}
                        />
                      </div>
                      <div className="tm-edit-row__field">
                        <span className="tm-edit-row__field-label">{copy.plansManage.trainingMax}</span>
                        <NumberPickerField
                          label={`${row.label} ${copy.plansManage.trainingMax}`}
                          value={row.trainingMaxKg}
                          min={0}
                          max={500}
                          step={0.5}
                          unit="kg"
                          formatValue={formatKg}
                          onChange={(value) => {
                            setStrengthDraft((prev) => ({
                              ...prev,
                              [row.key]: {
                                ...(prev[row.key] ?? { oneRepMaxKg: 0, trainingMaxKg: 0 }),
                                trainingMaxKg: value,
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="plan-sheet__empty">{copy.plansManage.noStrengthBaselines}</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <PrimaryButton
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                disabled={saving || deleting}
                onClick={() => {
                  void savePlanChanges();
                }}
              >
                {saving ? copy.plansManage.saveInProgress : copy.plansManage.saveChanges}
              </PrimaryButton>
              <PrimaryButton
                as="a"
                variant="secondary"
                size="lg"
                fullWidth
                href={`${APP_ROUTES.plansHistory}?planId=${encodeURIComponent(managedPlan.id)}`}
              >
                {copy.plansManage.viewHistory}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="secondary"
                size="md"
                className="btn-danger"
                fullWidth
                disabled={saving || deleting}
                onClick={() => {
                  void deletePlan();
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 15,
                    fontVariationSettings: "'FILL' 0, 'wght' 300",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                  aria-hidden="true"
                >
                  delete
                </span>
                {deleting ? copy.plansManage.deleteInProgress : copy.plansManage.deletePlan}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="plan-sheet__empty">{copy.plansManage.notFound}</div>
        )}
      </BottomSheet>
    </>
  );
}
