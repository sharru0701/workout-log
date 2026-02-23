"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

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
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [selectedSlug, setSelectedSlug] = useState("");
  const [versions, setVersions] = useState<ProgramVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedBaseVersionId, setSelectedBaseVersionId] = useState("");

  const [changelog, setChangelog] = useState("Updated via UI");
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

  async function loadTemplates() {
    setLoadingTemplates(true);
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
      return;
    }
    setLoadingVersions(true);
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
    loadTemplates().catch((e: any) => setError(e?.message ?? "Failed to load templates"));
  }, [userId]);

  useEffect(() => {
    if (!selectedSlug) return;
    loadVersions(selectedSlug).catch((e: any) => setError(e?.message ?? "Failed to load versions"));
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
    setSuccess(`Forked template: ${res.template.slug}`);
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
    if (!selectedTemplate) throw new Error("Select a template");
    if (!selectedBaseVersion) throw new Error("Select base version");

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
        changelog: changelog.trim() || `Derived from v${selectedBaseVersion.version}`,
      },
    );

    await loadVersions(selectedTemplate.slug);
    await loadTemplates();
    setSelectedBaseVersionId(res.programVersion.id);
    setSuccess(`Created ${selectedTemplate.slug} v${res.programVersion.version}`);
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Templates</h1>

      <div className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-neutral-600">userId</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
          <span className="text-xs text-neutral-600">Search template/program</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={searchQuery}
            placeholder="name, slug, type, tag..."
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
          <span className="text-xs text-neutral-600">Tag filter</span>
          <select
            className="rounded-lg border px-3 py-2"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="">(all tags)</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-4 text-sm text-neutral-600">
          {loadingTemplates ? "Loading templates..." : `${filteredTemplates.length}/${templates.length} templates visible`}
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button
            className="rounded-xl border px-4 py-2 font-medium"
            onClick={() => {
              setError(null);
              setSuccess(null);
              loadTemplates().catch((e: any) => setError(e?.message ?? "Failed to reload"));
            }}
          >
            Reload
          </button>
          <a className="rounded-xl border px-4 py-2 font-medium" href="/plans">
            Go to Plans
          </a>
        </div>
        {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
        {success && <div className="md:col-span-6 text-sm text-green-700">{success}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="font-medium">Public Templates</div>
          {publicTemplates.length === 0 ? (
            <div className="text-sm text-neutral-600">No public templates.</div>
          ) : (
            <ul className="space-y-2">
              {publicTemplates.map((t) => (
                <li key={t.slug} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button className="text-left" onClick={() => setSelectedSlug(t.slug)}>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-neutral-600">
                        {t.slug} · {t.type} · latest v{t.latestVersion?.version ?? "-"}
                      </div>
                      {Array.isArray(t.tags) && t.tags.length > 0 && (
                        <div className="text-xs text-neutral-600">tags: {t.tags.join(", ")}</div>
                      )}
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
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
          )}
        </div>

        <div className="rounded-2xl border p-4 space-y-3">
          <div className="font-medium">My Private Templates</div>
          {myPrivateTemplates.length === 0 ? (
            <div className="text-sm text-neutral-600">No private templates yet. Fork one to start editing.</div>
          ) : (
            <ul className="space-y-2">
              {myPrivateTemplates.map((t) => (
                <li key={t.slug} className="rounded-lg border px-3 py-2">
                  <button className="w-full text-left" onClick={() => setSelectedSlug(t.slug)}>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-neutral-600">
                      {t.slug} · {t.type} · latest v{t.latestVersion?.version ?? "-"}
                    </div>
                    {Array.isArray(t.tags) && t.tags.length > 0 && (
                      <div className="text-xs text-neutral-600">tags: {t.tags.join(", ")}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="font-medium">Template Editor</div>
        {!selectedTemplate ? (
          <div className="text-sm text-neutral-600">Select a template to view versions and edit.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{selectedTemplate.name}</div>
                <div className="text-xs text-neutral-600">
                  {selectedTemplate.slug} · {selectedTemplate.type} · {selectedTemplate.visibility}
                </div>
              </div>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs text-neutral-600">Base version</span>
                <select
                  className="rounded-lg border px-3 py-2"
                  value={selectedBaseVersionId}
                  onChange={(e) => setSelectedBaseVersionId(e.target.value)}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} - {new Date(v.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loadingVersions && <div className="text-sm text-neutral-600">Loading version history...</div>}

            {selectedTemplate.type === "MANUAL" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">MANUAL session editor</div>
                  <button className="rounded-lg border px-3 py-1 text-sm" onClick={addManualSession}>
                    + Session
                  </button>
                </div>

                {manualSessions.map((session, sessionIdx) => (
                  <div key={sessionIdx} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-600">Session key</span>
                      <input
                        className="rounded-lg border px-2 py-1 text-sm"
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
                        className="rounded-lg border px-2 py-1 text-xs"
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
                          <input
                            className="rounded-lg border px-2 py-1 text-sm flex-1"
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
                            className="rounded-lg border px-2 py-1 text-xs"
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
                            <label className="flex flex-col gap-1">
                              <span className="text-xs text-neutral-600">reps</span>
                              <input
                                type="number"
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={setRow.reps}
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
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx
                                                        ? { ...ss, reps: Number(e.target.value) || 0 }
                                                        : ss,
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
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs text-neutral-600">weightKg</span>
                              <input
                                type="number"
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={setRow.targetWeightKg}
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
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx
                                                        ? { ...ss, targetWeightKg: Number(e.target.value) || 0 }
                                                        : ss,
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
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs text-neutral-600">rpe</span>
                              <input
                                type="number"
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={setRow.rpe}
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
                                                    sets: it.sets.map((ss, ssi) =>
                                                      ssi === setIdx
                                                        ? { ...ss, rpe: Number(e.target.value) || 0 }
                                                        : ss,
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
                            </label>
                            <button
                              className="rounded-lg border px-2 py-1 text-xs"
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
                          className="rounded-lg border px-2 py-1 text-xs"
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
                      className="rounded-lg border px-2 py-1 text-xs"
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
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium">LOGIC safe parameters</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-600">TM % (defaults.tmPercent)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="rounded-lg border px-3 py-2"
                      value={logicTmPercent}
                      onChange={(e) => setLogicTmPercent(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-600">Frequency (sessions/week)</span>
                    <input
                      type="number"
                      min={1}
                      className="rounded-lg border px-3 py-2"
                      value={logicFrequency}
                      onChange={(e) => setLogicFrequency(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-600">Cycle weeks</span>
                    <input
                      type="number"
                      min={1}
                      className="rounded-lg border px-3 py-2"
                      value={logicWeeks}
                      onChange={(e) => setLogicWeeks(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-neutral-600">Exercise substitutions</div>
                  {logicSubstitutions.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-neutral-600">target</span>
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={row.target}
                          onChange={(e) =>
                            setLogicSubstitutions((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, target: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 md:col-span-3">
                        <span className="text-xs text-neutral-600">exerciseName</span>
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={row.exerciseName}
                          onChange={(e) =>
                            setLogicSubstitutions((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, exerciseName: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                      <button
                        className="rounded-lg border px-2 py-1 text-xs"
                        onClick={() => setLogicSubstitutions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    className="rounded-lg border px-3 py-1 text-sm"
                    onClick={() =>
                      setLogicSubstitutions((prev) => [...prev, { target: "", exerciseName: "" }])
                    }
                  >
                    + Substitution
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border p-3 space-y-2">
              <div className="text-sm font-medium">Create new version</div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600">changelog</span>
                <input
                  className="rounded-lg border px-3 py-2"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                />
              </label>
              <button
                className="rounded-xl border px-4 py-2 font-medium"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  createNewVersion().catch((e: any) => setError(e?.message ?? "Version create failed"));
                }}
                disabled={!selectedBaseVersion || !canEditSelectedTemplate}
              >
                Create Version
              </button>
              {!canEditSelectedTemplate && (
                <div className="text-xs text-neutral-600">
                  This template is read-only. Fork it to create your own editable version history.
                </div>
              )}
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium mb-2">Version history</div>
              {versions.length === 0 ? (
                <div className="text-sm text-neutral-600">No versions.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-neutral-600">
                      <tr>
                        <th className="text-left py-2 pr-4">Version</th>
                        <th className="text-left py-2 px-4">Created</th>
                        <th className="text-left py-2 pl-4">Changelog</th>
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
