"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card } from "@/components/ui/card";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppTextInput } from "@/components/ui/form-controls";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

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

function PlanListCard({
  plan,
  onManage,
}: {
  plan: Plan;
  onManage: () => void;
}) {
  return (
    <Card padding="md" tone="inset" elevated={false} style={{ marginBottom: "var(--space-sm)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
        <div style={{ flex: 1 }}>
          <strong style={{ font: "var(--font-card-title)", display: "block", marginBottom: "3px" }}>
            {plan.name}
          </strong>
          {plan.baseProgramName ? (
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", display: "block", marginBottom: "2px" }}>
              {plan.baseProgramName}
            </span>
          ) : null}
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", display: "block" }}>
            최근: {plan.lastPerformedAt ? formatDateTime(plan.lastPerformedAt) : "기록 없음"}
          </span>
        </div>
        <button
          type="button"
          onClick={onManage}
          style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 10, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 700, color: "var(--color-text)", cursor: "pointer", letterSpacing: "-0.1px" }}
        >
          관리
        </button>
      </div>

      <PrimaryButton
        as="a"
        variant="secondary"
        size="md"
        fullWidth
        href={`/plans/history?planId=${encodeURIComponent(plan.id)}`}
      >
        수행 히스토리
      </PrimaryButton>
    </Card>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function PlansManagePageContent() {
  const { alert, confirm } = useAppDialog();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState("plans-manage:load:init");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
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
    void loadPlans({ isRefresh: refreshTick > 0 });
  }, [loadPlans, refreshTick]);

  useEffect(() => {
    if (!managePlanId) return;
    if (plans.some((item) => item.id === managePlanId)) return;
    setManagePlanId("");
    setSaving(false);
    setDeleting(false);
  }, [managePlanId, plans]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
  });

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
      
      // Optimistic UI: 즉각적으로 이름 업데이트
      setPlans((prev) => prev.map((item) => (item.id === managedPlan.id ? { ...item, name: nextName } : item)));

      const res = await apiPatch<{ plan: Plan }>(`/api/plans/${encodeURIComponent(managedPlan.id)}`, {
        name: nextName,
      });
      // 서버 응답으로 정확히 재동기화
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
      
      // Optimistic UI: 즉각적으로 목록에서 제거
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
      // 실패 시 데이터 원상 복구
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
      <PullToRefreshShell pullToRefresh={pullToRefresh}>

        <section>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Plan Management</span>
            <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 4px" }}>플랜 목록</h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.4 }}>진행 중인 플랜을 빠르게 확인하고, 필요할 때 이름 변경 또는 삭제를 관리하세요.</p>
          </div>

          {plans.length > 0 || searchQuery.trim().length > 0 ? (
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="플랜명 또는 기반 프로그램 검색"
              ariaLabel="플랜 검색"
            />
          ) : null}

          {loading && (
            <div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "55%", marginBottom: 8 }} />
                      <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 12, width: "70%", marginBottom: 6 }} />
                      <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 12, width: "50%" }} />
                    </div>
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 32, width: 64 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <ErrorStateRows
            message={error}
            title="플랜 목록 조회 실패"
            onRetry={() => {
              void loadPlans();
            }}
          />
          <EmptyStateRows
            when={isSettled && !error && plans.length === 0}
            label="플랜이 없습니다"
            description="프로그램 스토어에서 먼저 플랜을 생성하세요."
          />
          <EmptyStateRows
            when={isSettled && !error && plans.length > 0 && filteredPlans.length === 0}
            label="검색 결과가 없습니다"
            description="플랜명 또는 기반 프로그램명으로 다시 검색하세요."
          />

          {filteredPlans.length > 0 ? (
            <div style={{ marginTop: "var(--space-sm)" }}>
              {filteredPlans.map((plan) => (
                <PlanListCard
                  key={plan.id}
                  plan={plan}
                  onManage={() => openManageSheet(plan)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </PullToRefreshShell>

      <BottomSheet
        open={Boolean(managePlanId)}
        onClose={() => {
          if (saving || deleting) return;
          setManagePlanId("");
        }}
        title="플랜 상세정보"
        description="상세 조회 / 이름 수정 / 삭제"
        closeLabel="닫기"
      >
        {managedPlan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ background: "var(--color-surface-2)", borderRadius: 14, padding: "var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>기반 프로그램</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>{managedPlan.baseProgramName ?? "-"}</div>
              </div>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>생성일</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{formatDateTime(managedPlan.createdAt)}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>마지막 수행일</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{managedPlan.lastPerformedAt ? formatDateTime(managedPlan.lastPerformedAt) : "기록 없음"}</div>
              </div>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>플랜 이름</span>
              <AppTextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="플랜 이름"
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <PrimaryButton
                as="a"
                variant="primary"
                size="lg"
                fullWidth
                href={`/plans/history?planId=${encodeURIComponent(managedPlan.id)}`}
              >
                수행 히스토리
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
                {saving ? "저장 중..." : "이름 저장"}
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
                {deleting ? "삭제 중..." : "플랜 삭제"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <Card tone="subtle" padding="sm" elevated={false}>
            관리할 플랜을 찾을 수 없습니다.
          </Card>
        )}
      </BottomSheet>
    </>
  );
}

export default function PlansManagePage() {
  return <PlansManagePageContent />;
}
