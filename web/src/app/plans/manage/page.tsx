"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppTextInput } from "@/components/ui/form-controls";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import settingsListStyles from "@/components/ui/settings-list.module.css";
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function PlansManagePageContent() {
  const { alert, confirm } = useAppDialog();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState("plans-manage:load:init");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [managePlanId, setManagePlanId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const managedPlan = useMemo(
    () => plans.find((item) => item.id === managePlanId) ?? null,
    [managePlanId, plans],
  );
  const isSettled = useQuerySettled(loadKey, loading);

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
        className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll"
        {...pullToRefresh.bind}
      >
        <div className="pull-refresh-indicator">
          {pullToRefresh.isRefreshing
            ? "플랜 새로고침 중..."
            : pullToRefresh.pullOffset > 0
              ? "당겨서 새로고침"
              : ""}
        </div>

        <section className="grid gap-2">
          <div className="ios-section-heading">플랜 목록</div>
          <p className="text-sm text-neutral-600">
            진행 중인 플랜을 빠르게 확인하고, 필요할 때 이름 변경 또는 삭제를 관리하세요.
          </p>

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

          {plans.length > 0 ? (
            <article className="motion-card rounded-2xl border p-4 grid gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="haptic-tap rounded-xl border p-3 grid gap-1 text-left"
                  onClick={() => openManageSheet(plan)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="min-w-0 truncate">{plan.name}</strong>
                    <span
                      aria-hidden="true"
                      className={settingsListStyles.chevron}
                      style={{ color: "var(--settings-chevron-color, color-mix(in srgb, var(--text-secondary) 88%, transparent))" }}
                    />
                  </span>
                </button>
              ))}
            </article>
          ) : null}
        </section>
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
          <div className="space-y-3 pb-2">
            <div className="rounded-xl border bg-neutral-50 p-3 space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="ui-card-label">기반 프로그램</div>
                  <div>{managedPlan.baseProgramName ?? "-"}</div>
                </div>
                <div>
                  <div className="ui-card-label">생성일</div>
                  <div>{formatDateTime(managedPlan.createdAt)}</div>
                </div>
                <div>
                  <div className="ui-card-label">마지막 수행일</div>
                  <div>{managedPlan.lastPerformedAt ? formatDateTime(managedPlan.lastPerformedAt) : "기록 없음"}</div>
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="ui-card-label">플랜 이름</span>
              <AppTextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="플랜 이름"
              />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="haptic-tap ui-primary-button min-h-12 px-4 text-base font-semibold"
                disabled={saving || deleting}
                onClick={() => {
                  void savePlanName();
                }}
              >
                {saving ? "저장 중..." : "이름 저장"}
              </button>
              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-base font-semibold text-[var(--color-danger)]"
                disabled={saving || deleting}
                onClick={() => {
                  void deletePlan();
                }}
              >
                {deleting ? "삭제 중..." : "플랜 삭제"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-neutral-50 p-3 text-sm text-neutral-700">
            관리할 플랜을 찾을 수 없습니다.
          </div>
        )}
      </BottomSheet>
    </>
  );
}

export default function PlansManagePage() {
  return <PlansManagePageContent />;
}
