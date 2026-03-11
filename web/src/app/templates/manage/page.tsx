"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { AccordionSection } from "@/components/ui/accordion-section";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";

type TemplateItem = {
  id: string;
  slug: string;
  name: string;
  type: "LOGIC" | "MANUAL";
  visibility: "PUBLIC" | "PRIVATE";
  tags?: string[] | null;
  ownerUserId?: string | null;
  latestVersion: { id: string; version: number; definition: any; defaults?: any } | null;
};

type ProgramVersion = {
  id: string;
  templateId: string;
  version: number;
  parentVersionId: string | null;
  definition: any;
  defaults: any;
  changelog: string | null;
  createdAt: string;
};

type ManualSet = {
  reps: number;
  targetWeightKg: number;
  rpe: number;
};

type ManualItem = {
  exerciseName: string;
  sets: ManualSet[];
};

type ManualSession = {
  key: string;
  items: ManualItem[];
};

type SubstitutionRow = {
  target: string;
  exerciseName: string;
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeManualDefinition(definition: any): ManualSession[] {
  const sessions = Array.isArray(definition?.sessions) ? definition.sessions : [];
  const out = sessions.map((s: any, idx: number) => {
    const key = String(s?.key ?? String.fromCharCode(65 + (idx % 26))).trim() || `S${idx + 1}`;
    const itemsRaw = Array.isArray(s?.items) ? s.items : [];
    const items = itemsRaw.map((it: any) => {
      const exerciseName = String(it?.exerciseName ?? "").trim();
      const setSource =
        Array.isArray(it?.sets) && it.sets.length > 0
          ? it.sets
          : [{ reps: Number(it?.reps ?? 0), targetWeightKg: Number(it?.targetWeightKg ?? it?.weightKg ?? 0), rpe: Number(it?.rpe ?? 0) }];
      const sets = setSource.map((ss: any) => ({
        reps: Number(ss?.reps ?? 0) || 0,
        targetWeightKg: Number(ss?.targetWeightKg ?? ss?.weightKg ?? 0) || 0,
        rpe: Number(ss?.rpe ?? 0) || 0,
      }));
      return {
        exerciseName,
        sets: sets.length > 0 ? sets : [{ reps: 0, targetWeightKg: 0, rpe: 0 }],
      };
    });

    return {
      key,
      items: items.length > 0 ? items : [{ exerciseName: "", sets: [{ reps: 0, targetWeightKg: 0, rpe: 0 }] }],
    };
  });

  if (out.length > 0) return out;
  return [
    {
      key: "A",
      items: [{ exerciseName: "", sets: [{ reps: 0, targetWeightKg: 0, rpe: 0 }] }],
    },
  ];
}

function buildManualDefinition(sessions: ManualSession[]) {
  return {
    kind: "manual",
    sessions: sessions.map((s) => ({
      key: s.key.trim() || "A",
      items: s.items
        .map((it) => ({
          exerciseName: it.exerciseName.trim(),
          sets: it.sets
            .map((ss) => ({
              reps: Number(ss.reps) || 0,
              targetWeightKg: Number(ss.targetWeightKg) || 0,
              rpe: Number(ss.rpe) || 0,
            }))
            .filter((ss) => ss.reps > 0 || ss.targetWeightKg > 0 || ss.rpe > 0),
        }))
        .filter((it) => it.exerciseName),
    })),
  };
}

export default function TemplatesPage() {
  const [userId, setUserId] = useState("dev");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesLoadKey, setTemplatesLoadKey] = useState("templates-manage:templates:init");

  const [selectedSlug, setSelectedSlug] = useState("");
  const [versions, setVersions] = useState<ProgramVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsLoadKey, setVersionsLoadKey] = useState<string | null>(null);
  const [selectedBaseVersionId, setSelectedBaseVersionId] = useState("");

  const [changelog, setChangelog] = useState("UI에서 업데이트");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [manualSessions, setManualSessions] = useState<ManualSession[]>(normalizeManualDefinition(null));
  const [logicFrequency, setLogicFrequency] = useState(4);
  const [logicWeeks, setLogicWeeks] = useState(4);
  const [logicTmPercent, setLogicTmPercent] = useState(0.9);
  const [logicSubstitutions, setLogicSubstitutions] = useState<SubstitutionRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const allTags = useMemo(() => {
    const tags = templates.flatMap((t) => t.tags ?? []).map((x) => String(x).trim()).filter(Boolean);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.slug === selectedSlug) ?? null,
    [selectedSlug, templates],
  );
  const selectedBaseVersion = useMemo(
    () => versions.find((v) => v.id === selectedBaseVersionId) ?? versions[0] ?? null,
    [selectedBaseVersionId, versions],
  );
  const canEditSelectedTemplate = useMemo(() => {
    if (!selectedTemplate) return false;
    return selectedTemplate.visibility === "PRIVATE" && Boolean(selectedTemplate.ownerUserId);
  }, [selectedTemplate]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      const tags = (t.tags ?? []).map((tag) => String(tag).toLowerCase());
      const tagMatch = !selectedTag || tags.includes(selectedTag.toLowerCase());
      if (!tagMatch) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        tags.some((tag) => tag.includes(q))
      );
    });
  }, [searchQuery, selectedTag, templates]);

  const publicTemplates = useMemo(
    () => filteredTemplates.filter((t) => t.visibility === "PUBLIC"),
    [filteredTemplates],
  );
  const myPrivateTemplates = useMemo(
    () => filteredTemplates.filter((t) => t.visibility === "PRIVATE"),
    [filteredTemplates],
  );
  const isTemplatesSettled = useQuerySettled(templatesLoadKey, loadingTemplates);
  const isVersionsSettled = useQuerySettled(versionsLoadKey, loadingVersions);
  const showPublicTemplatesEmpty = isTemplatesSettled && publicTemplates.length === 0;
  const showPrivateTemplatesEmpty = isTemplatesSettled && myPrivateTemplates.length === 0;
  const showTemplateEditorEmpty = isTemplatesSettled && !selectedTemplate;
  const showVersionsEmpty = isVersionsSettled && Boolean(selectedTemplate) && versions.length === 0;

  async function loadTemplates() {
    setLoadingTemplates(true);
    setTemplatesLoadKey(`templates-manage:templates:${Date.now()}`);
    try {
      const res = await apiGet<{ items: TemplateItem[] }>("/api/templates?limit=200");
      setTemplates(res.items);
      setSelectedSlug((prev) => {
        if (prev && res.items.some((t) => t.slug === prev)) return prev;
        return res.items[0]?.slug ?? "";
      });
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadVersions(slug: string) {
    if (!slug) {
      setVersions([]);
      setSelectedBaseVersionId("");
      setVersionsLoadKey(null);
      return;
    }
    setLoadingVersions(true);
    setVersionsLoadKey(`templates-manage:versions:${slug}:${Date.now()}`);
    try {
      const res = await apiGet<{ template: TemplateItem; versions: ProgramVersion[] }>(
        `/api/templates/${encodeURIComponent(slug)}/versions`,
      );
      setVersions(res.versions);
      setSelectedBaseVersionId((prev) =>
        prev && res.versions.some((v) => v.id === prev) ? prev : res.versions[0]?.id ?? "",
      );
    } finally {
      setLoadingVersions(false);
    }
  }

  useEffect(() => {
    loadTemplates().catch((e: any) => setError(e?.message ?? "템플릿을 불러오지 못했습니다."));
  }, [userId]);

  useEffect(() => {
    if (!selectedSlug) {
      setVersions([]);
      setSelectedBaseVersionId("");
      setVersionsLoadKey(null);
      return;
    }
    loadVersions(selectedSlug).catch((e: any) => setError(e?.message ?? "버전 목록을 불러오지 못했습니다."));
  }, [selectedSlug, userId]);

  useEffect(() => {
    if (!selectedTemplate || !selectedBaseVersion) return;

    const baseDef = selectedBaseVersion.definition ?? {};
    const baseDefaults = selectedBaseVersion.defaults ?? {};

    if (selectedTemplate.type === "MANUAL") {
      setManualSessions(normalizeManualDefinition(baseDef));
      return;
    }

    const schedule = baseDef?.schedule ?? {};
    setLogicFrequency(Number(schedule?.sessionsPerWeek ?? 4) || 4);
    setLogicWeeks(Number(schedule?.weeks ?? 4) || 4);
    setLogicTmPercent(Number(baseDefaults?.tmPercent ?? 0.9) || 0.9);

    const rawSubs = baseDefaults?.exerciseSubstitutions;
    const subRows: SubstitutionRow[] = rawSubs && typeof rawSubs === "object"
      ? Object.entries(rawSubs as Record<string, unknown>).map(([target, exerciseName]) => ({
          target: String(target).trim().toUpperCase(),
          exerciseName: String(exerciseName ?? "").trim(),
        }))
      : [];
    setLogicSubstitutions(subRows.length > 0 ? subRows : [{ target: "SQUAT", exerciseName: "" }]);
  }, [selectedBaseVersion, selectedTemplate]);

  async function forkTemplate(slug: string) {
    const res = await apiPost<{ template: TemplateItem }>(`/api/templates/${encodeURIComponent(slug)}/fork`, {});
    await loadTemplates();
    setSelectedSlug(res.template.slug);
    setSuccess(`템플릿을 포크했습니다: ${res.template.slug}`);
  }

  function addManualSession() {
    setManualSessions((prev) => [
      ...prev,
      {
        key: `S${prev.length + 1}`,
        items: [{ exerciseName: "", sets: [{ reps: 0, targetWeightKg: 0, rpe: 0 }] }],
      },
    ]);
  }

  async function createNewVersion() {
    if (!selectedTemplate) throw new Error("템플릿을 먼저 선택하세요.");
    if (!selectedBaseVersion) throw new Error("기준 버전을 선택하세요.");

    const nextDefinition = cloneValue(selectedBaseVersion.definition ?? {});
    const nextDefaults = cloneValue(selectedBaseVersion.defaults ?? {});

    if (selectedTemplate.type === "MANUAL") {
      Object.assign(nextDefinition, buildManualDefinition(manualSessions));
    } else {
      nextDefinition.schedule = {
        ...(nextDefinition.schedule ?? {}),
        weeks: Math.max(1, Math.floor(Number(logicWeeks) || 4)),
        sessionsPerWeek: Math.max(1, Math.floor(Number(logicFrequency) || 4)),
      };
      nextDefaults.tmPercent = Number(logicTmPercent) || 0.9;
      const substitutions = logicSubstitutions
        .map((s) => ({ target: s.target.trim().toUpperCase(), exerciseName: s.exerciseName.trim() }))
        .filter((s) => s.target && s.exerciseName);
      nextDefaults.exerciseSubstitutions = Object.fromEntries(
        substitutions.map((s) => [s.target, s.exerciseName]),
      );
    }

    const res = await apiPost<{ programVersion: ProgramVersion }>(
      `/api/templates/${encodeURIComponent(selectedTemplate.slug)}/versions`,
      {
        baseVersionId: selectedBaseVersion.id,
        definition: nextDefinition,
        defaults: nextDefaults,
        changelog: changelog.trim() || `v${selectedBaseVersion.version} 기반 생성`,
      },
    );

    await loadVersions(selectedTemplate.slug);
    await loadTemplates();
    setSelectedBaseVersionId(res.programVersion.id);
    setSuccess(`${selectedTemplate.slug} v${res.programVersion.version} 버전을 생성했습니다.`);
  }

  return (
    <div className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll">

      <div className="motion-card rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="ui-card-label">사용자 ID</span>
          <AppTextInput
            variant="compact"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
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
              value={searchQuery}
              placeholder="이름, slug, 타입, 태그..."
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim().length > 0 ? (
              <button
                type="button"
                className="app-search-clear"
                aria-label="검색어 지우기"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>
        <AppSelect
          label="태그 필터"
          wrapperClassName="md:col-span-3"
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
        >
          <option value="">전체 태그</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </AppSelect>
        <div className="md:col-span-4 text-sm text-neutral-600">{`${filteredTemplates.length}/${templates.length}개 표시 중`}</div>
        <div className="md:col-span-4 flex gap-2">
          <button
            className="haptic-tap rounded-xl border px-4 py-2 font-medium"
            onClick={() => {
              setError(null);
              setSuccess(null);
              loadTemplates().catch((e: any) => setError(e?.message ?? "템플릿을 다시 불러오지 못했습니다."));
            }}
          >
            다시 불러오기
          </button>
          <a className="haptic-tap rounded-xl border px-4 py-2 font-medium" href={APP_ROUTES.plansHome}>
            플랜 화면
          </a>
        </div>
        <div className="md:col-span-8">
          <LoadingStateRows
            active={loadingTemplates || loadingVersions}
            label="불러오는 중"
            description="템플릿 및 버전 목록을 확인하고 있습니다."
          />
        </div>
        <div className="md:col-span-8">
          <ErrorStateRows
            message={error}
            onRetry={() => {
              setError(null);
              setSuccess(null);
              loadTemplates()
                .then(() => (selectedSlug ? loadVersions(selectedSlug) : Promise.resolve()))
                .catch((e: any) => setError(e?.message ?? "템플릿을 다시 불러오지 못했습니다."));
            }}
          />
        </div>
        <div className="md:col-span-8">
          <NoticeStateRows message={success} tone="success" label="완료" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <AccordionSection
            title="공개 템플릿"
            description="공식 템플릿을 확인하고 포크합니다."
            defaultOpen
            summarySlot={<span className="ui-card-label">{publicTemplates.length}</span>}
          >
            <EmptyStateRows
              when={showPublicTemplatesEmpty}
              label="설정 값 없음"
              description="표시할 공개 템플릿이 없습니다."
            />
            {publicTemplates.length > 0 ? (
              <ul className="space-y-2">
                {publicTemplates.map((t) => (
                  <li key={t.slug} className="motion-card rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button className="haptic-tap text-left" onClick={() => setSelectedSlug(t.slug)}>
                        <div className="font-medium">{t.name}</div>
                        <div className="ui-card-label">
                          {t.slug} · {t.type} · 최신 v{t.latestVersion?.version ?? "-"}
                        </div>
                        {Array.isArray(t.tags) && t.tags.length > 0 && (
                          <div className="ui-card-label">tags: {t.tags.join(", ")}</div>
                        )}
                      </button>
                      <button
                        className="haptic-tap rounded-lg border px-3 py-1 text-sm"
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          forkTemplate(t.slug).catch((e: any) => setError(e?.message ?? "Fork failed"));
                        }}
                      >
                        Fork
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </AccordionSection>
        </div>

        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <AccordionSection
            title="내 개인 템플릿"
            description="현재 사용자가 편집할 수 있는 템플릿입니다."
            summarySlot={<span className="ui-card-label">{myPrivateTemplates.length}</span>}
          >
            <EmptyStateRows
              when={showPrivateTemplatesEmpty}
              label="설정 값 없음"
              description="개인 템플릿이 없습니다. 공개 템플릿을 포크해 편집을 시작하세요."
            />
            {myPrivateTemplates.length > 0 ? (
              <ul className="space-y-2">
                {myPrivateTemplates.map((t) => (
                  <li key={t.slug} className="motion-card rounded-lg border px-3 py-2">
                    <button className="haptic-tap w-full text-left" onClick={() => setSelectedSlug(t.slug)}>
                      <div className="font-medium">{t.name}</div>
                      <div className="ui-card-label">
                        {t.slug} · {t.type} · 최신 v{t.latestVersion?.version ?? "-"}
                      </div>
                      {Array.isArray(t.tags) && t.tags.length > 0 && (
                        <div className="ui-card-label">tags: {t.tags.join(", ")}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </AccordionSection>
        </div>
      </div>

      <div className="motion-card rounded-2xl border p-4 space-y-4">
        <div className="ios-section-heading">템플릿 편집기</div>
        <EmptyStateRows
          when={showTemplateEditorEmpty}
          label="설정 값 없음"
          description="좌측 목록에서 템플릿을 선택하면 버전/편집 설정이 표시됩니다."
        />
        {selectedTemplate ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{selectedTemplate.name}</div>
                <div className="ui-card-label">
                  {selectedTemplate.slug} · {selectedTemplate.type} · {selectedTemplate.visibility}
                </div>
              </div>

              <AppSelect
                label="기준 버전"
                wrapperClassName="md:col-span-2"
                value={selectedBaseVersionId}
                onChange={(e) => setSelectedBaseVersionId(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} - {new Date(v.createdAt).toLocaleString()}
                  </option>
                ))}
              </AppSelect>
            </div>

            <LoadingStateRows
              active={loadingVersions}
              label="불러오는 중"
              description="버전 이력을 조회하고 있습니다."
            />

            {selectedTemplate.type === "MANUAL" ? (
              <AccordionSection
                title="수동 세션 편집"
                description="세션, 아이템, 세트 단위로 편집합니다."
                summarySlot={<span className="ui-card-label">{manualSessions.length} sessions</span>}
              >
                <div className="flex items-center justify-between">
                  <div className="ios-inline-heading">MANUAL session editor</div>
                  <button className="haptic-tap rounded-lg border px-3 py-1 text-sm" onClick={addManualSession}>
                    + Session
                  </button>
                </div>

                {manualSessions.map((session, sessionIdx) => (
                  <div key={sessionIdx} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="ui-card-label">Session key</span>
                      <AppTextInput
                        variant="dense"
                        value={session.key}
                        onChange={(e) =>
                          setManualSessions((prev) =>
                            prev.map((s, i) =>
                              i === sessionIdx
                                ? {
                                    ...s,
                                    key: e.target.value,
                                  }
                                : s,
                            ),
                          )
                        }
                      />
                      <button
                        className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                        onClick={() =>
                          setManualSessions((prev) => prev.filter((_, i) => i !== sessionIdx))
                        }
                      >
                        Remove session
                      </button>
                    </div>

                    {session.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="rounded-lg border p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <AppTextInput
                            variant="dense"
                            className="flex-1"
                            placeholder="exerciseName"
                            value={item.exerciseName}
                            onChange={(e) =>
                              setManualSessions((prev) =>
                                prev.map((s, si) =>
                                  si === sessionIdx
                                    ? {
                                        ...s,
                                        items: s.items.map((it, ii) =>
                                          ii === itemIdx
                                            ? {
                                                ...it,
                                                exerciseName: e.target.value,
                                              }
                                            : it,
                                        ),
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                          <button
                            className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                            onClick={() =>
                              setManualSessions((prev) =>
                                prev.map((s, si) =>
                                  si === sessionIdx
                                    ? {
                                        ...s,
                                        items: s.items.filter((_, ii) => ii !== itemIdx),
                                      }
                                    : s,
                                ),
                              )
                            }
                          >
                            Remove item
                          </button>
                        </div>

                        {item.sets.map((setRow, setIdx) => (
                          <div key={setIdx} className="grid grid-cols-4 gap-2 items-end">
                            <div className="flex flex-col gap-1">
                              <span className="ui-card-label">reps</span>
                              <NumberPickerField
                                label="Reps"
                                value={setRow.reps}
                                min={0}
                                max={100}
                                step={1}
                                variant="workout-number"
                                onChange={(v) =>
                                  setManualSessions((prev) =>
                                    prev.map((s, si) =>
                                      si === sessionIdx
                                        ? {
                                            ...s,
                                            items: s.items.map((it, ii) =>
                                              ii === itemIdx
                                                ? {
                                                    ...it,
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx ? { ...ss, reps: v } : ss,
                                                    ),
                                                  }
                                                : it,
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="ui-card-label">weightKg</span>
                              <NumberPickerField
                                label="Weight (kg)"
                                value={setRow.targetWeightKg}
                                min={0}
                                max={500}
                                step={0.5}
                                unit="kg"
                                variant="workout-number"
                                formatValue={(v) => v.toFixed(1)}
                                onChange={(v) =>
                                  setManualSessions((prev) =>
                                    prev.map((s, si) =>
                                      si === sessionIdx
                                        ? {
                                            ...s,
                                            items: s.items.map((it, ii) =>
                                              ii === itemIdx
                                                ? {
                                                    ...it,
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx ? { ...ss, targetWeightKg: v } : ss,
                                                    ),
                                                  }
                                                : it,
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="ui-card-label">rpe</span>
                              <NumberPickerField
                                label="RPE"
                                value={setRow.rpe}
                                min={0}
                                max={10}
                                step={0.5}
                                variant="workout-number"
                                formatValue={(v) => v.toFixed(1)}
                                onChange={(v) =>
                                  setManualSessions((prev) =>
                                    prev.map((s, si) =>
                                      si === sessionIdx
                                        ? {
                                            ...s,
                                            items: s.items.map((it, ii) =>
                                              ii === itemIdx
                                                ? {
                                                    ...it,
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx ? { ...ss, rpe: v } : ss,
                                                    ),
                                                  }
                                                : it,
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <button
                              className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                              onClick={() =>
                                setManualSessions((prev) =>
                                  prev.map((s, si) =>
                                    si === sessionIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, ii) =>
                                            ii === itemIdx
                                              ? {
                                                  ...it,
                                                  sets: it.sets.filter((_, ssi) => ssi !== setIdx),
                                                }
                                              : it,
                                          ),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            >
                              Remove set
                            </button>
                          </div>
                        ))}

                        <button
                          className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                          onClick={() =>
                            setManualSessions((prev) =>
                              prev.map((s, si) =>
                                si === sessionIdx
                                  ? {
                                      ...s,
                                      items: s.items.map((it, ii) =>
                                        ii === itemIdx
                                          ? {
                                              ...it,
                                              sets: [...it.sets, { reps: 0, targetWeightKg: 0, rpe: 0 }],
                                            }
                                          : it,
                                      ),
                                    }
                                  : s,
                              ),
                            )
                          }
                        >
                          + Set
                        </button>
                      </div>
                    ))}

                    <button
                      className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                      onClick={() =>
                        setManualSessions((prev) =>
                          prev.map((s, si) =>
                            si === sessionIdx
                              ? {
                                  ...s,
                                  items: [...s.items, { exerciseName: "", sets: [{ reps: 0, targetWeightKg: 0, rpe: 0 }] }],
                                }
                              : s,
                          ),
                        )
                      }
                    >
                      + Item
                    </button>
                  </div>
                ))}
              </AccordionSection>
            ) : (
              <AccordionSection
                title="로직 안전 파라미터"
                description="스케줄과 대체 규칙을 설정합니다."
                summarySlot={<span className="ui-card-label">{logicFrequency}/week</span>}
              >
                <div className="ios-inline-heading">로직 안전 파라미터</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="ui-card-label">TM % (defaults.tmPercent)</span>
                    <NumberPickerField
                      label="TM %"
                      value={logicTmPercent}
                      min={0}
                      max={1}
                      step={0.01}
                      variant="workout-number"
                      formatValue={(v) => v.toFixed(2)}
                      onChange={(v) => setLogicTmPercent(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="ui-card-label">Frequency (sessions/week)</span>
                    <NumberPickerField
                      label="Frequency"
                      value={logicFrequency}
                      min={1}
                      max={7}
                      step={1}
                      variant="workout-number"
                      unit="회/주"
                      onChange={(v) => setLogicFrequency(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="ui-card-label">Cycle weeks</span>
                    <NumberPickerField
                      label="Cycle weeks"
                      value={logicWeeks}
                      min={1}
                      max={52}
                      step={1}
                      variant="workout-number"
                      unit="주"
                      onChange={(v) => setLogicWeeks(v)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="ui-card-label">Exercise substitutions</div>
                  {logicSubstitutions.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="ui-card-label">target</span>
                        <AppTextInput
                          variant="dense"
                          value={row.target}
                          onChange={(e) =>
                            setLogicSubstitutions((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, target: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 md:col-span-3">
                        <span className="ui-card-label">exerciseName</span>
                        <AppTextInput
                          variant="dense"
                          value={row.exerciseName}
                          onChange={(e) =>
                            setLogicSubstitutions((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, exerciseName: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                      <button
                        className="haptic-tap rounded-lg border px-2 py-1 text-xs"
                        onClick={() => setLogicSubstitutions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    className="haptic-tap rounded-lg border px-3 py-1 text-sm"
                    onClick={() =>
                      setLogicSubstitutions((prev) => [...prev, { target: "", exerciseName: "" }])
                    }
                  >
                    + Substitution
                  </button>
                </div>
              </AccordionSection>
            )}

            <AccordionSection
              title="새 버전 생성"
              description="선택한 기준 버전에서 파생합니다."
              summarySlot={<span className="ui-card-label">v{selectedBaseVersion?.version ?? "-"}</span>}
            >
              <div className="motion-card rounded-xl border p-3 space-y-2">
                <div className="ios-inline-heading">새 버전 생성</div>
                <label className="flex flex-col gap-1">
                  <span className="ui-card-label">changelog</span>
                  <AppTextInput
                    variant="compact"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                  />
                </label>
                <button
                  className="haptic-tap ui-primary-button px-4 py-2 font-medium"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    createNewVersion().catch((e: any) => setError(e?.message ?? "버전 생성에 실패했습니다."));
                  }}
                  disabled={!selectedBaseVersion || !canEditSelectedTemplate}
                >
                  버전 생성
                </button>
                <DisabledStateRows
                  when={!canEditSelectedTemplate}
                  label="편집 비활성"
                  description="이 템플릿은 읽기 전용입니다. 포크 후 개인 템플릿에서 버전을 생성하세요."
                  className="mt-2"
                />
              </div>
            </AccordionSection>

            <AccordionSection
              title="버전 기록"
              description="시간순 변경 이력을 확인합니다."
              summarySlot={<span className="ui-card-label">{versions.length} versions</span>}
            >
              <div className="motion-card rounded-xl border p-3">
                <EmptyStateRows
                  when={showVersionsEmpty}
                  label="설정 값 없음"
                  description="선택한 템플릿의 버전 이력이 아직 없습니다."
                />
                {versions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm ios-data-table">
                      <thead className="text-neutral-600">
                        <tr>
                          <th className="text-left py-2 pr-4">버전</th>
                          <th className="text-left py-2 px-4">생성일</th>
                          <th className="text-left py-2 pl-4">변경 내역</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr key={v.id} className="border-t">
                            <td className="py-2 pr-4">v{v.version}</td>
                            <td className="py-2 px-4">{new Date(v.createdAt).toLocaleString()}</td>
                            <td className="py-2 pl-4">{v.changelog ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </AccordionSection>
          </>
        ) : null}
      </div>
    </div>
  );
}
