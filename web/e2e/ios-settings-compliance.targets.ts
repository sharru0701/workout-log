export type IosSettingsComplianceTarget = {
  id: string;
  title: string;
  path: string;
  hasStateChecks?: boolean;
  visualBaseline?: boolean;
};

export const iosSettingsComplianceTargets: IosSettingsComplianceTarget[] = [
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

export const iosSettingsA11yTargets = iosSettingsComplianceTargets;

export const iosSettingsVisualTargets = iosSettingsComplianceTargets.filter((target) => target.visualBaseline);
