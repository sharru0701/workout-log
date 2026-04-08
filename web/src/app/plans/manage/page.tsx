"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { useAppDialog } from "@/shared/ui/app-dialog-provider";
import { AppTextInput } from "@/shared/ui/form-controls";
import { PrimaryButton } from "@/shared/ui/primary-button";
import { SearchInput } from "@/shared/ui/search-input";
import { EmptyStateRows, ErrorStateRows } from "@/shared/ui/settings-state";
import { apiDelete, apiGet, apiPatch } from "@/shared/api/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";


type Plan = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: any;
  createdAt: string;
  baseProgramName?: string | null;
  lastPerformedAt?: string | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return date.toLocaleDateString();
}

function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function PlanListCard({
  plan,
  onManage,
  copy,
}: {
  plan: Plan;
  onManage: () => void;
  copy: ReturnType<typeof useLocale>["copy"];
}) {
  const relativeDate = formatRelativeDate(plan.lastPerformedAt);

  return (
    <div
      style={{
        background: "var(--color-surface-container-low)",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "var(--space-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          marginBottom: "12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong
            style={{
              fontFamily: "var(--font-headline-family)",
              fontSize: "17px",
              fontWeight: 700,
              color: "var(--color-text)",
              display: "block",
              marginBottom: "3px",
              letterSpacing: "-0.2px",
            }}
          >
            {plan.name}
          </strong>
          {plan.baseProgramName ? (
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-primary)",
                display: "block",
                marginBottom: "2px",
              }}
            >
              {plan.baseProgramName}
            </span>
          ) : null}
          <span
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              display: "block",
            }}
            >
            {relativeDate ? `${copy.plansManage.recentPerformedPrefix} · ${relativeDate}` : copy.plansManage.noPerformedHistory}
          </span>
        </div>

        <button
          type="button"
          onClick={onManage}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
            padding: "6px 12px",
            borderRadius: "10px",
            background: "transparent",
            border: "1px solid var(--color-border)",
            fontSize: "12px",
            fontFamily: "var(--font-label-family)",
            fontWeight: 700,
            color: "var(--color-text)",
            cursor: "pointer",
          }}
          aria-label={`${plan.name} ${copy.plansManage.manage}`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            aria-hidden="true"
          >
            edit
          </span>
          {copy.plansManage.manage}
        </button>
      </div>

      <a
        href={`/plans/history?planId=${encodeURIComponent(plan.id)}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          width: "100%",
          padding: "9px 16px",
          borderRadius: "10px",
          background: "var(--color-surface-container-highest)",
          border: "none",
          fontSize: "13px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 15, fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          aria-hidden="true"
        >
          history
        </span>
        {copy.plansManage.history}
      </a>
    </div>
  );
}

function PlansManagePageContent() {
  const { copy } = useLocale();
  const { alert, confirm } = useAppDialog();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState("plans-manage:load:init");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const storeHasLoadedRef = useRef(false);

  const [managePlanId, setManagePlanId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const managedPlan = useMemo(
    () => plans.find((item) => item.id === managePlanId) ?? null,
    [managePlanId, plans],
  );
  const isSettled = useQuerySettled(loadKey, loading);
  const filteredPlans = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return plans;
    return plans.filter((plan) =>
      normalizeSearchText(plan.name, plan.baseProgramName, plan.type).includes(normalizedQuery),
    );
  }, [plans, searchQuery]);

  const loadPlans = useCallback(async (options?: { isRefresh?: boolean }) => {
    try {
      if (!storeHasLoadedRef.current && !options?.isRefresh) setLoading(true);
      setLoadKey(`plans-manage:load:${Date.now()}`);
      setError(null);
      const res = await apiGet<{ items: Plan[] }>("/api/plans");
      storeHasLoadedRef.current = true;
      setPlans(res.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

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
    setManagePlanId(plan.id);
  }

  async function savePlanName() {
    if (!managedPlan) return;
    const nextName = nameDraft.trim();
    if (!nextName) {
      await alert({
        title: "입력 확인 필요",
        message: "플랜 이름은 비워둘 수 없습니다.",
        buttonText: "확인",
        tone: "danger",
      });
      return;
    }

    const prevPlanName = managedPlan.name;

    try {
      setSaving(true);
      setError(null);

      // Optimistic UI
      setPlans((prev) => prev.map((item) => (item.id === managedPlan.id ? { ...item, name: nextName } : item)));

      const res = await apiPatch<{ plan: Plan }>(`/api/plans/${encodeURIComponent(managedPlan.id)}`, {
        name: nextName,
      });
      setPlans((prev) => prev.map((item) => (item.id === managedPlan.id ? res.plan : item)));
      setManagePlanId("");
      await alert({
        title: "수정 완료",
        message: `플랜 이름이 변경되었습니다.\n${res.plan.name}`,
        buttonText: "확인",
      });
    } catch (e: any) {
      // 롤백
      if (managedPlan) {
        setPlans((prev) => prev.map((item) => (item.id === managedPlan.id ? { ...item, name: prevPlanName } : item)));
      }
      const message = e?.message ?? "플랜 이름 수정에 실패했습니다.";
      setError(message);
      await alert({
        title: "수정 실패",
        message,
        buttonText: "확인",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!managedPlan) return;
    const ok = await confirm({
      title: "플랜 삭제",
      message: `'${managedPlan.name}' 플랜을 삭제하시겠습니까?\n생성된 세션/진행 상태가 함께 정리됩니다.`,
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setDeleting(true);
      setError(null);

      // Optimistic UI
      const targetId = managedPlan.id;
      setManagePlanId("");
      setPlans((prev) => prev.filter((item) => item.id !== targetId));

      await apiDelete<{ deleted: boolean; planId: string }>(
        `/api/plans/${encodeURIComponent(targetId)}`,
      );
      await alert({
        title: "삭제 완료",
        message: `플랜이 삭제되었습니다.\n${managedPlan.name}`,
        buttonText: "확인",
      });
    } catch (e: any) {
      void loadPlans({ isRefresh: true });
      const message = e?.message ?? "플랜 삭제에 실패했습니다.";
      setError(message);
      await alert({
        title: "삭제 실패",
        message,
        buttonText: "확인",
        tone: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
        <section>
          {/* Page header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "var(--space-lg)",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-primary)",
                  marginBottom: "4px",
                }}
              >
                {copy.plansManage.headerEyebrow}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "26px",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                {copy.plansManage.title}
              </h1>
            </div>
          </div>

          {plans.length > 0 || searchQuery.trim().length > 0 ? (
            <div style={{ marginBottom: "var(--space-md)" }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={copy.plansManage.searchPlaceholder}
                ariaLabel={copy.plansManage.searchAriaLabel}
              />
            </div>
          ) : null}

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
            <div style={{ marginTop: "var(--space-sm)" }}>
              {filteredPlans.map((plan) => (
                <PlanListCard
                  key={plan.id}
                  plan={plan}
                  copy={copy}
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
            {/* Info grid */}
            <div
              style={{
                background: "var(--color-surface-container-low)",
                borderRadius: "14px",
                padding: "var(--space-md)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-md)",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-label-family)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  {copy.plansManage.baseProgram}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>
                  {managedPlan.baseProgramName ?? "-"}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-label-family)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  {copy.plansManage.createdAt}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                  {formatDateTime(managedPlan.createdAt)}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    fontFamily: "var(--font-label-family)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  {copy.plansManage.lastPerformedAt}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                  {managedPlan.lastPerformedAt ? formatDateTime(managedPlan.lastPerformedAt) : copy.plansManage.noRecord}
                </div>
              </div>
            </div>

            {/* Name edit */}
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                }}
              >
                {copy.plansManage.planName}
              </span>
              <AppTextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={copy.plansManage.planNamePlaceholder}
              />
            </label>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <PrimaryButton
                as="a"
                variant="secondary"
                size="lg"
                fullWidth
                href={`/plans/history?planId=${encodeURIComponent(managedPlan.id)}`}
              >
                {copy.plansManage.viewHistory}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                disabled={saving || deleting}
                onClick={() => {
                  void savePlanName();
                }}
              >
                {saving ? copy.plansManage.saveInProgress : copy.plansManage.saveName}
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
                  style={{ fontSize: 15, fontVariationSettings: "'FILL' 0, 'wght' 300", verticalAlign: "middle", marginRight: "4px" }}
                  aria-hidden="true"
                >
                  delete
                </span>
                {deleting ? copy.plansManage.deleteInProgress : copy.plansManage.deletePlan}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--color-surface-container-low)",
              borderRadius: "12px",
              padding: "var(--space-md)",
              color: "var(--color-text-muted)",
              fontSize: "14px",
            }}
          >
            {copy.plansManage.notFound}
          </div>
        )}
      </BottomSheet>
    </>
  );
}

export default function PlansManagePage() {
  return <PlansManagePageContent />;
}
