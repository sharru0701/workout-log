export type IosSettingsComplianceTarget = {
  id: string;
  title: string;
  path: string;
  hasStateChecks?: boolean;
  visualBaseline?: boolean;
};

export const iosSettingsComplianceTargets: IosSettingsComplianceTarget[] = [
  { id: "home", title: "루트", path: "/", visualBaseline: true },
  { id: "workout-today", title: "오늘 운동", path: "/workout/today" },
  { id: "calendar", title: "캘린더", path: "/calendar" },
  { id: "calendar-options", title: "캘린더 옵션", path: "/calendar/options" },
  { id: "plans", title: "플랜", path: "/plans" },
  { id: "plans-create", title: "플랜 만들기", path: "/plans/create" },
  { id: "plans-context", title: "생성 컨텍스트", path: "/plans/context" },
  { id: "stats", title: "통계", path: "/stats" },
  { id: "stats-filters", title: "통계 필터", path: "/stats/filters" },
  { id: "templates", title: "템플릿", path: "/templates" },
  { id: "offline", title: "오프라인 도움말", path: "/offline" },
  { id: "settings", title: "설정", path: "/settings", visualBaseline: true },
  { id: "settings-data", title: "데이터 내보내기", path: "/settings/data", visualBaseline: true },
  { id: "settings-save-policy", title: "저장 정책", path: "/settings/save-policy" },
  {
    id: "settings-state-samples",
    title: "상태 샘플",
    path: "/settings/state-samples",
    hasStateChecks: true,
    visualBaseline: true,
  },
  { id: "settings-selection-template", title: "선택 템플릿", path: "/settings/selection-template" },
  {
    id: "settings-invalid-deeplink",
    title: "잘못된 딥링크 안내",
    path: "/settings/link/settings.unknown",
    visualBaseline: true,
  },
];

export const iosSettingsA11yTargets = iosSettingsComplianceTargets.filter((target) =>
  [
    "home",
    "settings",
    "settings-data",
    "settings-save-policy",
    "settings-state-samples",
    "settings-selection-template",
    "settings-invalid-deeplink",
    "plans-context",
    "stats-filters",
    "calendar-options",
  ].includes(target.id),
);

export const iosSettingsVisualTargets = iosSettingsComplianceTargets.filter((target) => target.visualBaseline);
