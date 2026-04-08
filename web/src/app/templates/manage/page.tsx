"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { apiGet, apiPost } from "@/shared/api/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { AccordionSection } from "@/shared/ui/accordion-section";
import { AppSelect, AppTextInput } from "@/shared/ui/form-controls";
import { NumberPickerField } from "@/shared/ui/number-picker-sheet";
import { PrimaryButton } from "@/shared/ui/primary-button";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/shared/ui/settings-state";
import { Card } from "@/shared/ui/card";

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
  const { locale, copy } = useLocale();
  const emptyLabel = locale === "ko" ? "설정 값 없음" : "No items available";
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
  const templatesLoadedRef = useRef(false);

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
    if (!templatesLoadedRef.current) setLoadingTemplates(true);
    setTemplatesLoadKey(`templates-manage:templates:${Date.now()}`);
    try {
      const res = await apiGet<{ items: TemplateItem[] }>("/api/templates?limit=200");
      templatesLoadedRef.current = true;
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
    loadTemplates().catch((e: any) => setError(e?.message ?? copy.templatesManage.loadTemplatesError));
  }, [copy.templatesManage.loadTemplatesError, userId]);

  useEffect(() => {
    if (!selectedSlug) {
      setVersions([]);
      setSelectedBaseVersionId("");
      setVersionsLoadKey(null);
      return;
    }
    loadVersions(selectedSlug).catch((e: any) => setError(e?.message ?? copy.templatesManage.loadVersionsError));
  }, [copy.templatesManage.loadVersionsError, selectedSlug, userId]);

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
    setSuccess(copy.templatesManage.forkSuccess(res.template.slug));
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
    if (!selectedTemplate) throw new Error(copy.templatesManage.selectTemplateFirst);
    if (!selectedBaseVersion) throw new Error(copy.templatesManage.selectBaseVersionFirst);

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
        changelog: changelog.trim() || copy.templatesManage.basedOnVersion(selectedBaseVersion.version),
      },
    );

    await loadVersions(selectedTemplate.slug);
    await loadTemplates();
    setSelectedBaseVersionId(res.programVersion.id);
    setSuccess(copy.templatesManage.createVersionSuccess(selectedTemplate.slug, res.programVersion.version));
  }

  return (
    <div>

      <Card>
        <label>
          <span>사용자 ID</span>
          <AppTextInput
            variant="compact"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </label>
        <label>
          <span>{copy.templatesManage.searchLabel}</span>
          <div>
            <span aria-hidden="true">
              <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'wght' 400" }}>search</span>
            </span>
            <input
              type="search"
              inputMode="search"
              value={searchQuery}
              placeholder={copy.templatesManage.searchPlaceholder}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim().length > 0 ? (
              <button
                type="button"
                aria-label={copy.templatesManage.clearSearch}
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>
        <AppSelect
          label={copy.templatesManage.tagFilter}
          wrapperClassName="md:col-span-3"
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
        >
          <option value="">{copy.templatesManage.allTags}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </AppSelect>
        <div>{copy.templatesManage.visibleCount(filteredTemplates.length, templates.length)}</div>
        <div>
          <button
            onClick={() => {
              setError(null);
              setSuccess(null);
              loadTemplates().catch((e: any) => setError(e?.message ?? copy.templatesManage.reloadError));
            }}
          >
            {copy.templatesManage.reload}
          </button>
          <a href={APP_ROUTES.plansHome}>
            {copy.templatesManage.plansScreen}
          </a>
        </div>
        <div>
          <ErrorStateRows
            message={error}
            onRetry={() => {
              setError(null);
              setSuccess(null);
              loadTemplates()
                .then(() => (selectedSlug ? loadVersions(selectedSlug) : Promise.resolve()))
                .catch((e: any) => setError(e?.message ?? copy.templatesManage.reloadError));
            }}
          />
        </div>
        <div>
          <NoticeStateRows message={success} tone="success" label={copy.templatesManage.done} />
        </div>
      </Card>

      <div>
        <Card>
          <AccordionSection
            title={copy.templatesManage.publicTemplates}
            description={copy.templatesManage.publicTemplatesDescription}
            defaultOpen
            summarySlot={<span>{publicTemplates.length}</span>}
          >
            <EmptyStateRows
              when={showPublicTemplatesEmpty}
              label={emptyLabel}
              description={copy.templatesManage.noPublicTemplates}
            />
            {publicTemplates.length > 0 ? (
              <ul>
                {publicTemplates.map((t) => (
                  <Card as="li" key={t.slug} padding="sm">
                    <div>
                      <button onClick={() => setSelectedSlug(t.slug)}>
                        <div>{t.name}</div>
                        <div>
                          {t.slug} · {t.type} · {copy.templatesManage.latestVersionPrefix} v{t.latestVersion?.version ?? "-"}
                        </div>
                        {Array.isArray(t.tags) && t.tags.length > 0 && (
                          <div>tags: {t.tags.join(", ")}</div>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          forkTemplate(t.slug).catch((e: any) => setError(e?.message ?? copy.templatesManage.forkFailed));
                        }}
                      >
                        {copy.templatesManage.fork}
                      </button>
                    </div>
                  </Card>
                ))}
              </ul>
            ) : null}
          </AccordionSection>
        </Card>

        <Card>
          <AccordionSection
            title={copy.templatesManage.privateTemplates}
            description={copy.templatesManage.privateTemplatesDescription}
            summarySlot={<span>{myPrivateTemplates.length}</span>}
          >
            <EmptyStateRows
              when={showPrivateTemplatesEmpty}
              label={emptyLabel}
              description={`${copy.templatesManage.noPrivateTemplates} ${copy.templatesManage.privateTemplatesHelp}`}
            />
            {myPrivateTemplates.length > 0 ? (
              <ul>
                {myPrivateTemplates.map((t) => (
                  <Card as="li" key={t.slug} padding="sm">
                    <button onClick={() => setSelectedSlug(t.slug)}>
                      <div>{t.name}</div>
                      <div>
                        {t.slug} · {t.type} · {copy.templatesManage.latestVersionPrefix} v{t.latestVersion?.version ?? "-"}
                      </div>
                      {Array.isArray(t.tags) && t.tags.length > 0 && (
                        <div>tags: {t.tags.join(", ")}</div>
                      )}
                    </button>
                  </Card>
                ))}
              </ul>
            ) : null}
          </AccordionSection>
        </Card>
      </div>

      <Card padding="lg">
        <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary)", marginBottom: "4px" }}>{copy.templatesManage.editorEyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-headline-family)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>{copy.templatesManage.editorTitle}</h1>
        </div>
        <EmptyStateRows
          when={showTemplateEditorEmpty}
          label={emptyLabel}
          description={copy.templatesManage.editorEmpty}
        />
        {selectedTemplate ? (
          <>
            <div>
              <div>
                <div>{selectedTemplate.name}</div>
                <div>
                  {selectedTemplate.slug} · {selectedTemplate.type} · {selectedTemplate.visibility}
                </div>
              </div>

              <AppSelect
                label={copy.templatesManage.baseVersion}
                wrapperClassName="md:col-span-2"
                value={selectedBaseVersionId}
                onChange={(e) => setSelectedBaseVersionId(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} - {new Date(v.createdAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
                  </option>
                ))}
              </AppSelect>
            </div>

            {selectedTemplate.type === "MANUAL" ? (
              <AccordionSection
                title={copy.templatesManage.manualEditorTitle}
                description={copy.templatesManage.manualEditorDescription}
                summarySlot={<span>{manualSessions.length} {copy.templatesManage.sessions}</span>}
              >
                <div>
                  <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.templatesManage.manualEditorTitle}</h2>
                  <button onClick={addManualSession}>
                    {copy.templatesManage.addSession}
                  </button>
                </div>

                {manualSessions.map((session, sessionIdx) => (
                  <div key={sessionIdx}>
                    <div>
                      <span>{copy.templatesManage.sessionKey}</span>
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
                        onClick={() =>
                          setManualSessions((prev) => prev.filter((_, i) => i !== sessionIdx))
                        }
                      >
                        {copy.templatesManage.removeSession}
                      </button>
                    </div>

                    {session.items.map((item, itemIdx) => (
                      <div key={itemIdx}>
                        <div>
                          <AppTextInput
                            variant="dense"
                            placeholder={copy.templatesManage.exerciseName}
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
                            {copy.templatesManage.removeItem}
                          </button>
                        </div>

                        {item.sets.map((setRow, setIdx) => (
                          <div key={setIdx}>
                            <div>
                              <span>{copy.templatesManage.reps}</span>
                              <NumberPickerField
                                label={copy.templatesManage.reps}
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
                            <div>
                              <span>{copy.templatesManage.weightKg}</span>
                              <NumberPickerField
                                label={copy.templatesManage.weightKg}
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
                            <div>
                              <span>{copy.templatesManage.rpe}</span>
                              <NumberPickerField
                                label={copy.templatesManage.rpe}
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
                              {copy.templatesManage.removeSet}
                            </button>
                          </div>
                        ))}

                        <button
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
                          {copy.templatesManage.addSet}
                        </button>
                      </div>
                    ))}

                    <button
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
                      {copy.templatesManage.addItem}
                    </button>
                  </div>
                ))}
              </AccordionSection>
            ) : (
              <AccordionSection
                title={copy.templatesManage.logicSafeParams}
                description={copy.templatesManage.logicSafeDescription}
                summarySlot={<span>{logicFrequency}{copy.templatesManage.perWeek}</span>}
              >
                <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.templatesManage.logicSafeParams}</h2>
                <div>
                  <div>
                    <span>{copy.templatesManage.tmPercent} (defaults.tmPercent)</span>
                    <NumberPickerField
                      label={copy.templatesManage.tmPercent}
                      value={logicTmPercent}
                      min={0}
                      max={1}
                      step={0.01}
                      variant="workout-number"
                      formatValue={(v) => v.toFixed(2)}
                      onChange={(v) => setLogicTmPercent(v)}
                    />
                  </div>
                  <div>
                    <span>{copy.templatesManage.frequency} (sessions/week)</span>
                    <NumberPickerField
                      label={copy.templatesManage.frequency}
                      value={logicFrequency}
                      min={1}
                      max={7}
                      step={1}
                      variant="workout-number"
                      unit="회/주"
                      onChange={(v) => setLogicFrequency(v)}
                    />
                  </div>
                  <div>
                    <span>{copy.templatesManage.cycleWeeks}</span>
                    <NumberPickerField
                      label={copy.templatesManage.cycleWeeks}
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

                <div>
                  <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.templatesManage.exerciseSubstitutions}</h2>
                  {logicSubstitutions.map((row, idx) => (
                    <div key={idx}>
                      <label>
                        <span>{copy.templatesManage.target}</span>
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
                      <label>
                        <span>{copy.templatesManage.exerciseName}</span>
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
                        onClick={() => setLogicSubstitutions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        {copy.templatesManage.remove}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setLogicSubstitutions((prev) => [...prev, { target: "", exerciseName: "" }])
                    }
                  >
                    {copy.templatesManage.addSubstitution}
                  </button>
                </div>
              </AccordionSection>
            )}

            <AccordionSection
              title={copy.templatesManage.createVersion}
              description={copy.templatesManage.createVersionDescription}
              summarySlot={<span>v{selectedBaseVersion?.version ?? "-"}</span>}
            >
              <Card padding="sm">
                <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.templatesManage.createVersion}</h2>
                <label>
                  <span>changelog</span>
                  <AppTextInput
                    variant="compact"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                  />
                </label>
                <PrimaryButton
                  variant="primary"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    createNewVersion().catch((e: any) => setError(e?.message ?? copy.templatesManage.createVersionError));
                  }}
                  disabled={!selectedBaseVersion || !canEditSelectedTemplate}
                >
                  {copy.templatesManage.createVersion}
                </PrimaryButton>
                <DisabledStateRows
                  when={!canEditSelectedTemplate}
                  label={copy.templatesManage.readonly}
                  description={copy.templatesManage.readonlyDescription}
                />
              </Card>
            </AccordionSection>

            <AccordionSection
              title={copy.templatesManage.versionHistory}
              description={copy.templatesManage.versionHistoryDescription}
              summarySlot={<span>{versions.length} versions</span>}
            >
              <Card padding="sm">
                <EmptyStateRows
                  when={showVersionsEmpty}
                  label={emptyLabel}
                  description={copy.templatesManage.noVersions}
                />
                {versions.length > 0 ? (
                  <div>
                    <table>
                      <thead>
                        <tr>
                          <th>{copy.templatesManage.version}</th>
                          <th>{copy.templatesManage.createdAt}</th>
                          <th>{copy.templatesManage.changelog}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr key={v.id}>
                            <td>v{v.version}</td>
                            <td>{new Date(v.createdAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}</td>
                            <td>{v.changelog ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Card>
            </AccordionSection>
          </>
        ) : null}
      </Card>
    </div>
  );
}
