"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSection, DashboardSurface } from "@/components/dashboard/dashboard-primitives";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardActionGroup, CardMetaGrid, CardMetaItem } from "@/components/ui/card";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppTextInput } from "@/components/ui/form-controls";
import { PrimaryButton } from "@/components/ui/primary-button";
import { StoreSearchInput } from "@/components/ui/store-search-input";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
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
    <Card padding="md" tone="inset" elevated={false}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
        <div style={{ flex: 1 }}>
          <strong style={{ font: "var(--font-card-title)", display: "block", marginBottom: "2px" }}>
            {plan.name}
          </strong>
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", display: "block", marginBottom: "2px" }}>기반 프로그램: {plan.baseProgramName ?? "-"}</span>
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", display: "block" }}>
            최근 수행: {plan.lastPerformedAt ? formatDateTime(plan.lastPerformedAt) : "기록 없음"}
          </span>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="label label-note"
          style={{ cursor: "pointer", marginLeft: "var(--space-sm)" }}
        >
          관리
        </button>
      </div>

      <PrimaryButton
        as="a"
        variant="primary"
        size="lg"
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

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setLoadKey(`plans-manage:load:${Date.now()}`);
      setError(null);
      const res = await apiGet<{ items: Plan[] }>("/api/plans");
      setPlans(res.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
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
    triggerSelector: "[data-pull-refresh-trigger]",
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

    try {
      setSaving(true);
      setError(null);
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
      await apiDelete<{ deleted: boolean; planId: string }>(
        `/api/plans/${encodeURIComponent(managedPlan.id)}`,
      );
      setManagePlanId("");
      setPlans((prev) => prev.filter((item) => item.id !== managedPlan.id));
      await alert({
        title: "삭제 완료",
        message: `플랜이 삭제되었습니다.\n${managedPlan.name}`,
        buttonText: "확인",
      });
    } catch (e: any) {
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
      <div
        {...pullToRefresh.bind}
      >
        <PullToRefreshIndicator
          pullOffset={pullToRefresh.pullOffset}
          progress={pullToRefresh.progress}
          status={pullToRefresh.status}
          refreshingLabel="플랜 새로고침 중..."
          completeLabel="플랜 갱신 완료"
        />

        <DashboardSection
          title="플랜 목록"
          description="진행 중인 플랜을 빠르게 확인하고, 필요할 때 이름 변경 또는 삭제를 관리하세요."
          headerTrigger
        >
          {plans.length > 0 || searchQuery.trim().length > 0 ? (
            <DashboardSurface>
              <div>
                <span>플랜 검색</span>
                <StoreSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="플랜명 또는 기반 프로그램 검색"
                  ariaLabel="플랜 검색"
                  shellAriaLabel="플랜 검색 입력"
                />
              </div>
            </DashboardSurface>
          ) : null}

          <LoadingStateRows
            active={loading}
            label="플랜 목록 불러오는 중"
          />
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
            <div>
              {filteredPlans.map((plan) => (
                <PlanListCard
                  key={plan.id}
                  plan={plan}
                  onManage={() => openManageSheet(plan)}
                />
              ))}
            </div>
          ) : null}
        </DashboardSection>
      </div>

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
          <div>
            <Card tone="subtle" padding="sm" elevated={false}>
              <CardMetaGrid>
                <CardMetaItem label="기반 프로그램" value={managedPlan.baseProgramName ?? "-"} />
                <CardMetaItem label="생성일" value={formatDateTime(managedPlan.createdAt)} />
                <CardMetaItem
                  label="마지막 수행일"
                  value={managedPlan.lastPerformedAt ? formatDateTime(managedPlan.lastPerformedAt) : "기록 없음"}
                />
              </CardMetaGrid>
            </Card>

            <label>
              <span>플랜 이름</span>
              <AppTextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="플랜 이름"
              />
            </label>

            <CardActionGroup>
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
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => {
                  void deletePlan();
                }}
                >
                  {deleting ? "삭제 중..." : "플랜 삭제"}
                </button>
            </CardActionGroup>
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
