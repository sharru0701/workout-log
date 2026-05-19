import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Phase S 완료 후 legacy `components/ui/{card,primary-button,button}` 파일은 삭제됨.
// R4-1에서 settings-list 패밀리도 삭제 — V2 settings helpers는
// `@/components/v2/settings/section`, V2NavRow는 `@/components/v2/primitives`.
// 이 규칙은 향후 누군가 동일한 이름의 모듈을 다시 만들 경우를 대비한 가드.
const LEGACY_UI_IMPORT_RULE = [
  "error",
  {
    patterns: [
      {
        group: [
          "@/components/ui/card",
          "@/components/ui/primary-button",
          "@/components/ui/button",
          "@/components/ui/settings-list",
        ],
        message:
          'Use V2 primitives from "@/components/v2/primitives" (V2NavRow, etc.) ' +
          'and V2 settings helpers from "@/components/v2/settings/section" instead. ' +
          "See web/src/components/v2/primitives/README.md.",
      },
    ],
  },
];

// Hard Rules (web/docs/design-guide.md §0.5) — IDE/CLI 피드백용 warning.
// CI 회귀 차단은 `pnpm lint:design` (scripts/design-lint.mjs baseline)이 담당.
/* eslint-disable no-restricted-syntax -- 룰 정의 자체이므로 패턴 문자열은 제외 */
const HARD_RULES_SYNTAX = [
  "warn",
  {
    selector:
      "Property[key.name=/^border(Top|Bottom|Left|Right)?$/] > Literal[value=/1px\\s+(solid|dashed)/]",
    message:
      "[Rule 2] No-Line. Use <V2Hairline /> or paper tone transition (--v2-paper-2/3). For selection use boxShadow inset 0 0 0 2px var(--v2-accent). See design-guide.md §0.5.",
  },
  {
    selector:
      "Property[key.name=/^(borderRadius|fontSize|padding|gap|minHeight|minWidth)$/] > Literal[raw=/^([3-9]|[0-9]{2,})$/]",
    message:
      "[Rule 3] Hardcoded numeric value. Use var(--v2-s-N) / var(--v2-r-N) / var(--v2-t-N) tokens. See design-guide.md §0.5.",
  },
  {
    selector: "Literal[value=/btn btn-[a-z]/]",
    message:
      "[Rule 5] Legacy `.btn.btn-*` class. Use <V2PrimaryBtn> or <V2SecondaryBtn>. See design-guide.md §0.5.",
  },
  {
    selector: "Literal[value=/hd-cta/]",
    message:
      "[Rule 5] Legacy `.hd-cta-*` class. Use <V2PrimaryBtn>. See design-guide.md §0.5.",
  },
  {
    selector: "Literal[value=/label-tag-[a-z]/]",
    message:
      "[Rule 5] Legacy `.label-tag-*` class. Use <V2Chip>. See design-guide.md §0.5.",
  },
];
/* eslint-enable no-restricted-syntax */

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      // _prefix 로 시작하는 변수는 의도적으로 사용하지 않는 매개변수임을 표시 — 무시.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "no-restricted-imports": LEGACY_UI_IMPORT_RULE,
      "no-restricted-syntax": HARD_RULES_SYNTAX,
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
