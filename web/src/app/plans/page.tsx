"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

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

  useEffect(() => {
    if (!createSheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreateSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createSheetOpen]);

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
    if (!planIdToGenerate) throw new Error("Select a plan first");
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
        className="native-page native-page-enter mx-auto max-w-5xl p-4 space-y-4 sm:p-6 momentum-scroll"
        {...pullToRefresh.bind}
      >
        <div className="pull-refresh-indicator">
          {pullToRefresh.isRefreshing
            ? "Refreshing plans..."
            : pullToRefresh.pullOffset > 0
              ? "Pull to refresh"
              : ""}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Plans</h1>
          <button
            className="haptic-tap ui-primary-button min-h-12 px-5 text-base"
            onClick={() => setCreateSheetOpen(true)}
          >
            Create Plan
          </button>
        </div>

        <div className="rounded-2xl border p-4 space-y-3 ui-height-animate">
          <div className="text-sm text-neutral-600">Context</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">userId</span>
              <input
                className="rounded-lg border px-3 py-3 text-base"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">startDate</span>
              <input
                type="date"
                className="rounded-lg border px-3 py-3 text-base"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">timezone</span>
              <input
                className="rounded-lg border px-3 py-3 text-base"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">sessionKeyMode</span>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">week</span>
              <input
                className="rounded-lg border px-3 py-3 text-base"
                type="number"
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                min={1}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">day</span>
              <input
                className="rounded-lg border px-3 py-3 text-base"
                type="number"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                min={1}
              />
            </label>
          </div>

          {loadingTemplates && <div className="text-sm">Loading templates...</div>}
          {loadingPlans && <div className="text-sm">Loading plans...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <a className="text-xs underline" href="/templates">
            Manage templates and versions
          </a>
        </div>

        <div className="rounded-2xl border p-4 space-y-3 ui-height-animate">
          <div className="font-medium">Plan Cards</div>
          {plans.length === 0 ? (
            <div className="text-sm text-neutral-600">No plans found for this user.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {plans.map((p) => (
                <article
                  key={p.id}
                  className={`ui-list-item rounded-2xl border p-4 space-y-3 ${
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
                      Select
                    </button>
                    <button
                      className="haptic-tap ui-primary-button px-4 py-3 text-base font-medium"
                      onClick={() => {
                        setError(null);
                        generateSessionForPlan(p.id).catch((e) => setError(e.message));
                      }}
                    >
                      Quick Generate
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-4 space-y-3 ui-height-animate">
          <div className="font-medium">Selected Plan Generate</div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">selected plan</span>
            <select
              className="rounded-lg border px-3 py-3 text-base"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              <option value="">(select)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.type}]
                </option>
              ))}
            </select>
          </label>

          <button
            className="haptic-tap ui-primary-button min-h-12 w-full text-base"
            onClick={() => {
              setError(null);
              generateSession().catch((e) => setError(e.message));
            }}
          >
            Generate Selected Plan
          </button>

          {generated && (
            <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
              {JSON.stringify(generated.snapshot, null, 2)}
            </pre>
          )}
        </div>
      </div>

      <div
        className={`mobile-bottom-sheet ${createSheetOpen ? "is-open pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!createSheetOpen}
      >
        <button
          type="button"
          aria-label="Close create plan sheet"
          className="mobile-bottom-sheet-backdrop"
          onClick={() => setCreateSheetOpen(false)}
        />
        <section
          className="mobile-bottom-sheet-panel p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create plan"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Plan</h2>
              <button
                className="haptic-tap rounded-xl border px-4 py-2 text-sm font-medium"
                onClick={() => setCreateSheetOpen(false)}
              >
                Close
              </button>
            </div>

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
                <span className="text-xs text-neutral-600">Template/program search</span>
                <input
                  className="rounded-lg border px-3 py-3 text-base"
                  value={templateSearchQuery}
                  placeholder="name, slug, type, tag..."
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600">Template tag</span>
                <select
                  className="rounded-lg border px-3 py-3 text-base"
                  value={templateTag}
                  onChange={(e) => setTemplateTag(e.target.value)}
                >
                  <option value="">(all tags)</option>
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
                <div className="text-sm text-neutral-600">Select one template and specific version.</div>
                {templateSelect(templateOptions, singleSlug, setSingleSlug)}
                {versionSelect(singleSlug, singleVersionId, setSingleVersionId)}
              </div>
            ) : null}

            {createType === "COMPOSITE" ? (
              <div className="space-y-3">
                <div className="text-sm text-neutral-600">Mix per lift with explicit version per module.</div>
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-xs text-neutral-600">Squat template</label>
                  {templateSelect(logicTemplateOptions, squatSlug, setSquatSlug)}
                  {versionSelect(squatSlug, squatVersionId, setSquatVersionId)}

                  <label className="text-xs text-neutral-600">Bench template</label>
                  {templateSelect(logicTemplateOptions, benchSlug, setBenchSlug)}
                  {versionSelect(benchSlug, benchVersionId, setBenchVersionId)}

                  <label className="text-xs text-neutral-600">Deadlift template</label>
                  {templateSelect(logicTemplateOptions, deadSlug, setDeadSlug)}
                  {versionSelect(deadSlug, deadVersionId, setDeadVersionId)}
                </div>
              </div>
            ) : null}

            {createType === "MANUAL" ? (
              <div className="space-y-3">
                <div className="text-sm text-neutral-600">Pick manual template version and schedule keys.</div>
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
        </section>
      </div>
    </>
  );
}
