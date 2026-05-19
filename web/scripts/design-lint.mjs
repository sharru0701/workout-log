#!/usr/bin/env node

// design-lint — Hard Rules (web/docs/design-guide.md §0.5) 위반 카운트.
//
// 사용:
//   node scripts/design-lint.mjs            현재 카운트 + 파일별 Top 위반자 출력
//   node scripts/design-lint.mjs --json     JSON 출력
//   node scripts/design-lint.mjs --check    baseline 초과 시 exit 1 (CI용)
//   node scripts/design-lint.mjs --update   현재 카운트를 baseline에 기록
//
// baseline은 design-lint.baseline.json. 회귀 차단이 목적이므로 baseline을
// 줄이는 PR은 환영, 늘리는 PR은 차단됨.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../src");
const BASELINE_PATH = path.resolve(__dirname, "design-lint.baseline.json");
const SELF_PATH = fileURLToPath(import.meta.url);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out"]);

// 패턴 정의 — 각 룰의 카운트 가능한 위반 시그널
const RULES = [
  {
    key: "onePxSolid",
    label: "[Rule 2] 1px solid / dashed 잔존",
    extensions: [".ts", ".tsx", ".css"],
    regex: /\b1px\s+(?:solid|dashed)\b/g,
  },
  {
    key: "hardcodedBorderRadius",
    label: "[Rule 3] borderRadius 하드코딩 (>2)",
    extensions: [".ts", ".tsx"],
    regex: /\bborderRadius:\s*(\d+)\b/g,
    filterMatch: (m) => Number(m[1]) > 2,
  },
  {
    key: "hardcodedFontSize",
    label: "[Rule 3/4] fontSize 하드코딩",
    extensions: [".ts", ".tsx"],
    regex: /\bfontSize:\s*(?:(\d+)|"(\d+)px"|'(\d+)px')\b/g,
    filterMatch: (m) => Number(m[1] || m[2] || m[3]) > 2,
  },
  {
    key: "hardcodedPadding",
    label: "[Rule 3] padding 하드코딩 (>2)",
    extensions: [".ts", ".tsx"],
    regex: /\bpadding:\s*(?:(\d+)|"(\d+(?:px)?(?:\s+\d+(?:px)?){0,3})")/g,
    filterMatch: (m) => {
      if (m[1]) return Number(m[1]) > 2;
      const nums = m[2].split(/\s+/).map((s) => Number(s.replace("px", "")));
      return nums.some((n) => n > 2);
    },
  },
  {
    key: "hardcodedGap",
    label: "[Rule 3] gap 하드코딩 (>2)",
    extensions: [".ts", ".tsx"],
    regex: /\bgap:\s*(\d+)\b/g,
    filterMatch: (m) => Number(m[1]) > 2,
  },
  {
    key: "hardcodedMinHeight",
    label: "[Rule 3] minHeight 하드코딩 (>2)",
    extensions: [".ts", ".tsx"],
    regex: /\bminHeight:\s*(\d+)\b/g,
    filterMatch: (m) => Number(m[1]) > 2,
  },
  {
    key: "legacyBtnClass",
    label: "[Rule 5] .btn.btn-* 클래스",
    extensions: [".ts", ".tsx"],
    regex: /\bbtn\s+btn-[a-z]/g,
  },
  {
    key: "legacyHdCtaClass",
    // eslint-disable-next-line no-restricted-syntax -- 룰 패턴 정의 자체
    label: "[Rule 5] .hd-cta-* 클래스 (label string includes pattern)",
    extensions: [".ts", ".tsx"],
    regex: /\bhd-cta[-\w]*\b/g,
  },
  {
    key: "legacyLabelTagClass",
    label: "[Rule 5] .label-tag-* 클래스",
    extensions: [".ts", ".tsx"],
    regex: /\blabel-tag-[a-z]/g,
  },
  {
    key: "inlineFontFamilyOverride",
    label: "[Rule 4] inline fontFamily override",
    extensions: [".ts", ".tsx"],
    regex: /\bfontFamily:\s*["'`]?var\(--v2-f-/g,
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext) && full !== SELF_PATH) files.push(full);
    }
  }
  return files;
}

function countInFile(content, rule) {
  let count = 0;
  const matches = content.matchAll(rule.regex);
  for (const m of matches) {
    if (rule.filterMatch && !rule.filterMatch(m)) continue;
    count++;
  }
  return count;
}

function scan() {
  const files = walk(ROOT);
  const totals = {};
  const byFile = {};
  for (const rule of RULES) totals[rule.key] = 0;

  for (const file of files) {
    const ext = path.extname(file);
    const rel = path.relative(path.resolve(__dirname, ".."), file);
    const content = fs.readFileSync(file, "utf8");
    for (const rule of RULES) {
      if (!rule.extensions.includes(ext)) continue;
      const n = countInFile(content, rule);
      if (n > 0) {
        totals[rule.key] += n;
        if (!byFile[rel]) byFile[rel] = {};
        byFile[rel][rule.key] = n;
      }
    }
  }

  return { totals, byFile, scannedFiles: files.length };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function printReport({ totals, byFile, scannedFiles }, baseline) {
  console.log(`design-lint — scanned ${scannedFiles} files in web/src`);
  console.log();
  console.log("Totals");
  console.log("──────");
  const rows = RULES.map((r) => {
    const cur = totals[r.key];
    const base = baseline?.totals?.[r.key] ?? null;
    const delta = base === null ? "" : cur === base ? "  (=)" : cur > base ? `  (+${cur - base})` : `  (-${base - cur})`;
    return { key: r.key, label: r.label, cur, base, delta };
  });
  const labelW = Math.max(...rows.map((r) => r.label.length));
  for (const r of rows) {
    const baseStr = r.base === null ? "" : ` baseline=${r.base}`;
    console.log(`  ${r.label.padEnd(labelW)}  ${String(r.cur).padStart(4)}${baseStr}${r.delta}`);
  }
  console.log();

  const topOffenders = Object.entries(byFile)
    .map(([file, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { file, counts, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  if (topOffenders.length > 0) {
    console.log("Top offenders (15 worst files)");
    console.log("──────────────────────────────");
    for (const o of topOffenders) {
      const breakdown = Object.entries(o.counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(`  ${o.file}  [${o.total}]  ${breakdown}`);
    }
  }
}

function checkBaseline({ totals }, baseline) {
  if (!baseline) {
    console.error("design-lint: baseline 파일이 없습니다. --update로 먼저 생성하세요.");
    return 1;
  }
  const regressions = [];
  for (const rule of RULES) {
    const cur = totals[rule.key];
    const base = baseline.totals?.[rule.key] ?? 0;
    if (cur > base) {
      regressions.push({ key: rule.key, label: rule.label, cur, base, delta: cur - base });
    }
  }
  if (regressions.length === 0) {
    console.log("design-lint: ✓ baseline 준수 (회귀 없음)");
    return 0;
  }
  console.error("design-lint: ✗ baseline 초과 — 회귀 차단");
  console.error();
  for (const r of regressions) {
    console.error(`  ${r.label}: ${r.cur} (baseline ${r.base}, +${r.delta})`);
  }
  console.error();
  console.error("Hard Rules 위반이 늘어났습니다. web/docs/design-guide.md §0.5 참조.");
  console.error("줄이는 변경만 허용됩니다. baseline 갱신이 필요하면 --update 실행 후 커밋.");
  return 1;
}

function updateBaseline({ totals }) {
  const baseline = {
    note: "design-lint baseline — Hard Rules (design-guide.md §0.5) 위반 카운트. 줄이는 변경만 허용, --update로 갱신.",
    generatedAt: new Date().toISOString(),
    totals,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`design-lint: baseline 갱신 → ${path.relative(process.cwd(), BASELINE_PATH)}`);
  for (const rule of RULES) {
    console.log(`  ${rule.label}: ${totals[rule.key]}`);
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const result = scan();
  const baseline = loadBaseline();

  if (args.has("--json")) {
    console.log(JSON.stringify({ totals: result.totals, byFile: result.byFile }, null, 2));
    return 0;
  }
  if (args.has("--update")) {
    updateBaseline(result);
    return 0;
  }
  if (args.has("--check")) {
    return checkBaseline(result, baseline);
  }
  printReport(result, baseline);
  return 0;
}

process.exit(main());
