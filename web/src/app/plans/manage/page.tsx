"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";
import { InlineDisclosure } from "@/components/ui/inline-disclosure";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";

type TemplateItem = {
  id: string;
  slug: string;
  name: string;
  type: "LOGIC" | "MANUAL";
  visibility: "PUBLIC" | "PRIVATE";
  tags?: string[] | null;
  latestVersion: { id: string; version: number; definition: any } | null;
};

type ProgramVersion = {
  id: string;
  templateId: string;
  version: number;
  definition: any;
  defaults: any;
  changelog: string | null;
  createdAt: string;
};

type Plan = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: any;
  createdAt: string;
};

export default function PlansPage() {
  const [userId, setUserId] = useState("dev");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [sessionKeyMode, setSessionKeyMode] = useState<"DATE" | "LEGACY">("DATE");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [versionsBySlug, setVersionsBySlug] = useState<Record<string, ProgramVersion[]>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [generated, setGenerated] = useState<any>(null);

  const [singleSlug, setSingleSlug] = useState<string>("531");
  const [singleVersionId, setSingleVersionId] = useState<string>("");

  const [squatSlug, setSquatSlug] = useState("531");
  const [squatVersionId, setSquatVersionId] = useState("");
  const [benchSlug, setBenchSlug] = useState("operator");
  const [benchVersionId, setBenchVersionId] = useState("");
  const [deadSlug, setDeadSlug] = useState("candito-linear");
  const [deadVersionId, setDeadVersionId] = useState("");

  const [manualSlug, setManualSlug] = useState("manual");
  const [manualVersionId, setManualVersionId] = useState("");
  const [manualSchedule, setManualSchedule] = useState("A,B,A,B");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateTag, setTemplateTag] = useState("");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [createType, setCreateType] = useState<"SINGLE" | "COMPOSITE" | "MANUAL">("SINGLE");
  const [refreshTick, setRefreshTick] = useState(0);

  const templatesBySlug = useMemo(() => {
    const map = new Map<string, TemplateItem>();
    for (const t of templates) map.set(t.slug, t);
    return map;
  }, [templates]);

  const allTemplateTags = useMemo(() => {
    const tags = templates.flatMap((t) => t.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const templateOptions = useMemo(
    () => {
      const q = templateSearchQuery.trim().toLowerCase();
      return templates.filter((t) => {
        if (!t.latestVersion) return false;
        const tags = (t.tags ?? []).map((tag) => String(tag).toLowerCase());
        const tagMatch = !templateTag || tags.includes(templateTag.toLowerCase());
        if (!tagMatch) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          tags.some((tag) => tag.includes(q))
        );
      });
    },
    [templateSearchQuery, templateTag, templates],
  );
  const logicTemplateOptions = useMemo(
    () => templateOptions.filter((t) => t.type === "LOGIC"),
    [templateOptions],
  );
  const manualTemplateOptions = useMemo(
    () => templateOptions.filter((t) => t.type === "MANUAL"),
    [templateOptions],
  );
  const refreshPlansPage = useCallback(async () => {
    setRefreshTick((prev) => prev + 1);
  }, []);
  const pullToRefresh = usePullToRefresh({ onRefresh: refreshPlansPage });

  function versionsFor(slug: string) {
    return versionsBySlug[slug] ?? [];
  }

  function latestVersionIdFor(slug: string) {
    const vList = versionsFor(slug);
    if (vList[0]?.id) return vList[0].id;
    return templatesBySlug.get(slug)?.latestVersion?.id ?? "";
  }

  useEffect(() => {
    (async () => {
      try {
        setLoadingTemplates(true);
        setError(null);
        const res = await apiGet<{ items: TemplateItem[] }>("/api/templates?limit=200");
        setTemplates(res.items);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load templates");
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, [userId, refreshTick]);

  useEffect(() => {
    if (templates.length === 0) {
      setVersionsBySlug({});
      return;
    }

    (async () => {
      try {
        const pairs = await Promise.all(
          templates.map(async (t) => {
            const res = await apiGet<{ versions: ProgramVersion[] }>(
              `/api/templates/${encodeURIComponent(t.slug)}/versions`,
            );
            return [t.slug, res.versions] as const;
          }),
        );

        const next: Record<string, ProgramVersion[]> = {};
        for (const [slug, list] of pairs) next[slug] = list;
        setVersionsBySlug(next);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load template versions");
      }
    })();
  }, [templates, userId]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingPlans(true);
        setError(null);
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        setPlans(res.items);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load plans");
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [userId, refreshTick]);

  useEffect(() => {
    if (selectedPlanId && !plans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId("");
    }
  }, [plans, selectedPlanId]);

  useEffect(() => {
    setSingleVersionId((prev) => {
      const candidates = versionsFor(singleSlug);
      if (prev && candidates.some((v) => v.id === prev)) return prev;
      return latestVersionIdFor(singleSlug);
    });
  }, [singleSlug, versionsBySlug, templatesBySlug]);

  useEffect(() => {
    setSquatVersionId((prev) => {
      const candidates = versionsFor(squatSlug);
      if (prev && candidates.some((v) => v.id === prev)) return prev;
      return latestVersionIdFor(squatSlug);
    });
  }, [squatSlug, versionsBySlug, templatesBySlug]);

  useEffect(() => {
    setBenchVersionId((prev) => {
      const candidates = versionsFor(benchSlug);
      if (prev && candidates.some((v) => v.id === prev)) return prev;
      return latestVersionIdFor(benchSlug);
    });
  }, [benchSlug, versionsBySlug, templatesBySlug]);

  useEffect(() => {
    setDeadVersionId((prev) => {
      const candidates = versionsFor(deadSlug);
      if (prev && candidates.some((v) => v.id === prev)) return prev;
      return latestVersionIdFor(deadSlug);
    });
  }, [deadSlug, versionsBySlug, templatesBySlug]);

  useEffect(() => {
    setManualVersionId((prev) => {
      const candidates = versionsFor(manualSlug);
      if (prev && candidates.some((v) => v.id === prev)) return prev;
      return latestVersionIdFor(manualSlug);
    });
  }, [manualSlug, versionsBySlug, templatesBySlug]);

  function templateSelect(
    options: TemplateItem[],
    selectValue: string,
    onChange: (v: string) => void,
  ) {
    return (
      <select
        className="rounded-lg border px-3 py-3 text-base"
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.length === 0 && <option value="">(no templates match filter)</option>}
        {options.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name} ({t.slug}){Array.isArray(t.tags) && t.tags.length > 0 ? ` · ${t.tags.join(",")}` : ""}
          </option>
        ))}
      </select>
    );
  }

  function versionSelect(slug: string, versionId: string, onChange: (v: string) => void) {
    const versionList = versionsFor(slug);
    return (
      <select className="rounded-lg border px-3 py-3 text-base" value={versionId} onChange={(e) => onChange(e.target.value)}>
        {versionList.length === 0 ? <option value="">(no versions)</option> : null}
        {versionList.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.version}
          </option>
        ))}
      </select>
    );
  }

  function commonPlanParams(extra: Record<string, unknown> = {}) {
    return {
      startDate,
      timezone,
      sessionKeyMode,
      ...extra,
    };
  }

  async function createSingle() {
    const t = templatesBySlug.get(singleSlug);
    if (!t) throw new Error("template missing");
    if (!singleVersionId) throw new Error("version required");

    const selectedVersion = versionsFor(singleSlug).find((v) => v.id === singleVersionId);
    const selectedVersionLabel = selectedVersion ? `v${selectedVersion.version}` : "selected";

    const res = await apiPost<{ plan: Plan }>("/api/plans", {
      name: `Plan: ${t.name} (${selectedVersionLabel})`,
      type: t.type === "MANUAL" ? "MANUAL" : "SINGLE",
      rootProgramVersionId: singleVersionId,
      params: commonPlanParams(),
    });
    setPlans((p) => [res.plan, ...p]);
    setSelectedPlanId(res.plan.id);
  }

  async function createComposite() {
    const squat = templatesBySlug.get(squatSlug);
    const bench = templatesBySlug.get(benchSlug);
    const dead = templatesBySlug.get(deadSlug);
    if (!squat || !bench || !dead) throw new Error("template missing");
    if (!squatVersionId || !benchVersionId || !deadVersionId) {
      throw new Error("all module versions are required");
    }

    const res = await apiPost<{ plan: Plan }>("/api/plans", {
      name: `Hybrid: ${squat.slug}/${bench.slug}/${dead.slug}`,
      type: "COMPOSITE",
      modules: [
        { target: "SQUAT", programVersionId: squatVersionId, priority: 1 },
        { target: "BENCH", programVersionId: benchVersionId, priority: 2 },
        { target: "DEADLIFT", programVersionId: deadVersionId, priority: 3 },
      ],
      params: commonPlanParams(),
    });
    setPlans((p) => [res.plan, ...p]);
    setSelectedPlanId(res.plan.id);
  }

  async function createManualPlan() {
    const manual = templatesBySlug.get(manualSlug);
    if (!manual) throw new Error("manual template missing");
    if (!manualVersionId) throw new Error("manual version missing");

    const schedule = manualSchedule
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const version = versionsFor(manualSlug).find((v) => v.id === manualVersionId);
    const label = version ? `v${version.version}` : "selected";

    const res = await apiPost<{ plan: Plan }>("/api/plans", {
      name: `Manual plan (${label} · ${schedule.join("-")})`,
      type: "MANUAL",
      rootProgramVersionId: manualVersionId,
      params: commonPlanParams({ schedule }),
    });
    setPlans((p) => [res.plan, ...p]);
    setSelectedPlanId(res.plan.id);
  }

  async function generateSessionForPlan(planIdToGenerate: string) {
    if (!planIdToGenerate) throw new Error("먼저 플랜을 선택하세요.");
    const res = await apiPost<{ session: any }>(`/api/plans/${planIdToGenerate}/generate`, {
      week,
      day,
    });
    setSelectedPlanId(planIdToGenerate);
    setGenerated(res.session);
  }

  async function generateSession() {
    await generateSessionForPlan(selectedPlanId);
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
        <div className="tab-screen-header">
          <div className="flex items-center justify-between gap-3">
            <h1 className="tab-screen-title">플랜</h1>
            <button
              className="haptic-tap ui-primary-button min-h-12 px-5 text-base"
              onClick={() => setCreateSheetOpen(true)}
            >
              플랜 만들기
            </button>
          </div>
          <p className="tab-screen-caption">프로그램을 만들고 세션 생성 컨텍스트를 관리합니다.</p>
        </div>

        <div className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
          <div className="ios-section-heading">기본 흐름</div>
          <p className="text-sm text-neutral-600">
            1) 플랜 생성 2) 플랜 선택 3) 빠른 생성으로 결과 확인
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              className="haptic-tap ui-primary-button min-h-12 px-4 text-base font-medium"
              onClick={() => setCreateSheetOpen(true)}
            >
              플랜 만들기
            </button>
            <a className="haptic-tap rounded-xl border px-4 py-3 text-base font-medium text-center" href="/templates">
              템플릿 관리
            </a>
          </div>
        </div>

        <div className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
          <AccordionSection
            title="고급 컨텍스트"
            description="생성 기본값과 스케줄 키(선택)"
            summarySlot={
              <span className="ui-card-label">
                week {week} · day {day}
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">userId</span>
                <input
                  className="rounded-lg border px-3 py-3 text-base"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">startDate</span>
                <input
                  type="date"
                  className="rounded-lg border px-3 py-3 text-base"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">timezone</span>
                <input
                  className="rounded-lg border px-3 py-3 text-base"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">sessionKeyMode</span>
                <select
                  className="rounded-lg border px-3 py-3 text-base"
                  value={sessionKeyMode}
                  onChange={(e) => setSessionKeyMode(e.target.value as "DATE" | "LEGACY")}
                >
                  <option value="DATE">DATE (YYYY-MM-DD)</option>
                  <option value="LEGACY">LEGACY (WnDn)</option>
                </select>
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">week</span>
                <input
                  className="rounded-lg border px-3 py-3 text-base"
                  type="number"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                  min={1}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-card-label">day</span>
                <input
                  className="rounded-lg border px-3 py-3 text-base"
                  type="number"
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  min={1}
                />
              </label>
            </div>
          </AccordionSection>

          <LoadingStateRows
            active={loadingTemplates || loadingPlans}
            label="불러오는 중"
            description="템플릿과 플랜 목록을 동기화하고 있습니다."
            className="mt-2"
          />
          <ErrorStateRows
            message={error}
            onRetry={() => {
              setError(null);
              void refreshPlansPage();
            }}
            className="mt-2"
          />
          <a className="text-xs underline" href="/templates">
            템플릿/버전 관리
          </a>
        </div>

        <div className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
          <div className="ios-section-heading">플랜 카드</div>
          <p className="text-sm text-neutral-600">
            빠른 생성은 카드 단위로 즉시 실행됩니다. 수동 생성은 아래 섹션을 사용하세요.
          </p>
          <EmptyStateRows
            when={plans.length === 0}
            label="설정 값 없음"
            description="현재 사용자에 대해 생성된 플랜이 없습니다."
          />
          {plans.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {plans.map((p) => (
                <article
                  key={p.id}
                  className={`ui-list-item rounded-2xl border bg-neutral-50 p-4 space-y-3 ${
                    selectedPlanId === p.id ? "border-neutral-900" : ""
                  }`}
                >
                  <div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <div className="text-sm text-neutral-600">
                      {p.type} · {new Date(p.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="haptic-tap rounded-xl border px-4 py-3 text-base font-medium"
                      onClick={() => setSelectedPlanId(p.id)}
                    >
                      선택
                    </button>
                    <button
                      className="haptic-tap ui-primary-button px-4 py-3 text-base font-medium"
                      onClick={() => {
                        setError(null);
                        generateSessionForPlan(p.id).catch((e) => setError(e.message));
                      }}
                    >
                      빠른 생성
                    </button>
                  </div>
                  <div className="ui-card-label">
                    빠른 생성은 현재 주차/일차 값을 사용하고 미리보기를 즉시 갱신합니다.
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
          <AccordionSection
            title="선택 플랜 생성"
            description="수동 생성 및 스냅샷 미리보기"
            summarySlot={<span className="ui-card-label">{selectedPlanId ? "선택됨" : "플랜 없음"}</span>}
          >
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">선택된 플랜</span>
              <select
                className="rounded-lg border px-3 py-3 text-base"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">(선택)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.type}]
                  </option>
                ))}
              </select>
            </label>

            <button
              className="mt-3 haptic-tap ui-primary-button min-h-12 w-full text-base"
              onClick={() => {
                setError(null);
                generateSession().catch((e) => setError(e.message));
              }}
            >
              선택 플랜 생성
            </button>
            <div className="ui-card-label mt-2">
              실행할 플랜을 직접 선택해 수동으로 생성할 때 사용합니다.
            </div>
            <DisabledStateRows
              when={!selectedPlanId}
              label="선택된 플랜 없음"
              description="플랜 카드에서 선택하면 수동 생성 버튼이 활성화됩니다."
              className="mt-3"
            />

            {generated && (
              <InlineDisclosure className="mt-3" label="생성 스냅샷">
                <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                  {JSON.stringify(generated.snapshot, null, 2)}
                </pre>
              </InlineDisclosure>
            )}
          </AccordionSection>
        </div>
      </div>

      <BottomSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="플랜 만들기"
        description="템플릿 전략을 선택하고 초기 플랜을 생성합니다."
        closeLabel="닫기"
        panelClassName="p-0"
      >
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {(["SINGLE", "COMPOSITE", "MANUAL"] as const).map((type) => (
              <button
                key={type}
                className={`haptic-tap rounded-xl border px-3 py-3 text-sm font-semibold ${
                  createType === type ? "bg-bg-elevated" : ""
                }`}
                onClick={() => setCreateType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">템플릿/프로그램 검색</span>
              <input
                className="rounded-lg border px-3 py-3 text-base"
                value={templateSearchQuery}
                placeholder="이름, slug, type, tag..."
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">템플릿 태그</span>
              <select
                className="rounded-lg border px-3 py-3 text-base"
                value={templateTag}
                onChange={(e) => setTemplateTag(e.target.value)}
              >
                <option value="">(전체 태그)</option>
                {allTemplateTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {createType === "SINGLE" ? (
            <div className="space-y-3">
              <NoticeStateRows
                message="단일 템플릿과 버전을 선택해 플랜을 생성합니다."
                label="안내"
              />
              {templateSelect(templateOptions, singleSlug, setSingleSlug)}
              {versionSelect(singleSlug, singleVersionId, setSingleVersionId)}
            </div>
          ) : null}

          {createType === "COMPOSITE" ? (
            <div className="space-y-3">
              <NoticeStateRows
                message="리프트별 템플릿/버전을 조합해 복합 플랜을 생성합니다."
                label="안내"
              />
              <div className="grid grid-cols-1 gap-2">
                <label className="ui-card-label">Squat template</label>
                {templateSelect(logicTemplateOptions, squatSlug, setSquatSlug)}
                {versionSelect(squatSlug, squatVersionId, setSquatVersionId)}

                <label className="ui-card-label">Bench template</label>
                {templateSelect(logicTemplateOptions, benchSlug, setBenchSlug)}
                {versionSelect(benchSlug, benchVersionId, setBenchVersionId)}

                <label className="ui-card-label">Deadlift template</label>
                {templateSelect(logicTemplateOptions, deadSlug, setDeadSlug)}
                {versionSelect(deadSlug, deadVersionId, setDeadVersionId)}
              </div>
            </div>
          ) : null}

          {createType === "MANUAL" ? (
            <div className="space-y-3">
              <NoticeStateRows
                message="수동 템플릿 버전과 스케줄 키를 지정해 플랜을 생성합니다."
                label="안내"
              />
              {templateSelect(manualTemplateOptions, manualSlug, setManualSlug)}
              {versionSelect(manualSlug, manualVersionId, setManualVersionId)}
              <input
                className="rounded-lg border px-3 py-3 text-base"
                value={manualSchedule}
                onChange={(e) => setManualSchedule(e.target.value)}
              />
            </div>
          ) : null}

          <button
            className="haptic-tap ui-primary-button min-h-12 w-full text-base font-semibold"
            onClick={() => {
              setError(null);
              const createFlow =
                createType === "SINGLE"
                  ? createSingle()
                  : createType === "COMPOSITE"
                    ? createComposite()
                    : createManualPlan();
              createFlow
                .then(() => setCreateSheetOpen(false))
                .catch((e) => setError(e.message));
            }}
          >
            Create {createType} Plan
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
