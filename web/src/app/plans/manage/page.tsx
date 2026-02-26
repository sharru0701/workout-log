"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";
import { InlineDisclosure } from "@/components/ui/inline-disclosure";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

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

function dateOnlyInTimezone(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function workoutStartHref(planId: string, sessionDate: string) {
  const sp = new URLSearchParams();
  sp.set("planId", planId);
  sp.set("date", sessionDate);
  sp.set("autoGenerate", "1");
  return `/workout/today/log?${sp.toString()}`;
}

function PlansPageContent() {
  const searchParams = useSearchParams();
  const queryHandledRef = useRef(false);
  const [userId, setUserId] = useState("dev");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [sessionKeyMode, setSessionKeyMode] = useState<"DATE" | "LEGACY">("DATE");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [versionsBySlug, setVersionsBySlug] = useState<Record<string, ProgramVersion[]>>({});
  const [versionsLoadingBySlug, setVersionsLoadingBySlug] = useState<Record<string, boolean>>({});
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
  const [planCreateNotice, setPlanCreateNotice] = useState<string | null>(null);
  const loadingVersionSlugsRef = useRef(new Set<string>());

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
  const todayDate = useMemo(() => dateOnlyInTimezone(new Date(), timezone), [timezone]);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const selectedPlanStartHref = selectedPlanId ? workoutStartHref(selectedPlanId, todayDate) : "/workout/today/log";
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
    if (queryHandledRef.current) return;
    if (searchParams.get("create") !== "1") return;
    queryHandledRef.current = true;
    const requestedType = (searchParams.get("type") ?? "").toUpperCase();
    if (requestedType === "SINGLE" || requestedType === "COMPOSITE" || requestedType === "MANUAL") {
      setCreateType(requestedType);
    }
    setCreateSheetOpen(true);
  }, [searchParams]);

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
    if (templates.length > 0) return;
    setVersionsBySlug({});
    setVersionsLoadingBySlug({});
    loadingVersionSlugsRef.current.clear();
  }, [templates.length]);

  async function ensureTemplateVersions(slug: string) {
    if (!slug) return;
    if (versionsBySlug[slug] !== undefined) return;
    if (loadingVersionSlugsRef.current.has(slug)) return;

    loadingVersionSlugsRef.current.add(slug);
    setVersionsLoadingBySlug((prev) => ({ ...prev, [slug]: true }));
    try {
      const res = await apiGet<{ versions: ProgramVersion[] }>(
        `/api/templates/${encodeURIComponent(slug)}/versions`,
      );
      setVersionsBySlug((prev) => {
        if (prev[slug] !== undefined) return prev;
        return { ...prev, [slug]: res.versions };
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load template versions");
    } finally {
      loadingVersionSlugsRef.current.delete(slug);
      setVersionsLoadingBySlug((prev) => ({ ...prev, [slug]: false }));
    }
  }

  useEffect(() => {
    if (!createSheetOpen) return;
    if (templates.length === 0) return;

    void ensureTemplateVersions(singleSlug);
    void ensureTemplateVersions(squatSlug);
    void ensureTemplateVersions(benchSlug);
    void ensureTemplateVersions(deadSlug);
    void ensureTemplateVersions(manualSlug);
  }, [benchSlug, createSheetOpen, deadSlug, manualSlug, singleSlug, squatSlug, templates.length, versionsBySlug]);

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
    const isLoading = Boolean(versionsLoadingBySlug[slug]);
    return (
      <select className="rounded-lg border px-3 py-3 text-base" value={versionId} onChange={(e) => onChange(e.target.value)}>
        {versionList.length === 0 ? <option value="">{isLoading ? "(loading versions...)" : "(no versions)"}</option> : null}
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
    setPlanCreateNotice(`새 플랜 생성 완료: ${res.plan.name}`);
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
    setPlanCreateNotice(`새 조합 플랜 생성 완료: ${res.plan.name}`);
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
    setPlanCreateNotice(`새 수동 플랜 생성 완료: ${res.plan.name}`);
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
        <ScreenTitleCard
          title="플랜"
          note="커스텀 프로그램 생성 후 바로 운동 기록으로 이어집니다."
          actions={
            <button
              className="haptic-tap ui-primary-button min-h-12 px-5 text-base"
              onClick={() => setCreateSheetOpen(true)}
            >
              플랜 만들기
            </button>
          }
        />

        <div className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
          <div className="ios-section-heading">기본 흐름</div>
          <p className="text-sm text-neutral-600">
            1) 플랜 생성/선택 2) 오늘 운동 시작 3) 세트 기록 후 저장
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              className="haptic-tap ui-primary-button min-h-12 px-4 text-base font-medium"
              onClick={() => setCreateSheetOpen(true)}
            >
              플랜 만들기
            </button>
            <a className="haptic-tap rounded-xl border px-4 py-3 text-base font-medium text-center" href={selectedPlanStartHref}>
              {selectedPlan ? `${selectedPlan.name}으로 오늘 운동` : "오늘 운동 시작"}
            </a>
            <a className="haptic-tap rounded-xl border px-4 py-3 text-base font-medium text-center" href="/templates">
              템플릿 관리
            </a>
          </div>
          <NoticeStateRows
            message={planCreateNotice}
            tone="success"
            label="생성 상태"
          />
          <DisabledStateRows
            when={!selectedPlanId}
            label="선택된 플랜 없음"
            description="플랜 카드에서 선택하면 오늘 운동 딥링크가 해당 플랜으로 연결됩니다."
          />
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                    <a
                      className="haptic-tap rounded-xl border px-4 py-3 text-base font-medium text-center"
                      href={workoutStartHref(p.id, todayDate)}
                    >
                      오늘 운동
                    </a>
                  </div>
                  <div className="ui-card-label">
                    빠른 생성은 현재 주차/일차 값을 사용하고, 오늘 운동은 생성+기록 화면으로 바로 이동합니다.
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
            <a className="mt-2 block haptic-tap rounded-xl border px-4 py-3 text-center text-base font-medium" href={selectedPlanStartHref}>
              선택 플랜으로 오늘 운동 시작
            </a>
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
              <div className="app-search-shell">
                <span className="app-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </svg>
                </span>
                <input
                  type="search"
                  inputMode="search"
                  className="app-search-input"
                  value={templateSearchQuery}
                  placeholder="이름, slug, type, tag..."
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                />
                {templateSearchQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    className="app-search-clear"
                    aria-label="검색어 지우기"
                    onClick={() => setTemplateSearchQuery("")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
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
              setPlanCreateNotice(null);
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

export default function PlansPage() {
  return (
    <React.Suspense fallback={<div className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll" />}>
      <PlansPageContent />
    </React.Suspense>
  );
}
