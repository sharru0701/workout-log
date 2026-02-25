#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const steps = [
  {
    label: "Token contrast check",
    command: ["pnpm", "run", "test:a11y:contrast"],
  },
  {
    label: "Settings compliance suite (structure + axe + visual)",
    command: [
      "pnpm",
      "exec",
      "playwright",
      "test",
      "e2e/ios-settings-compliance.spec.ts",
      "e2e/ios-settings-a11y.spec.ts",
      "e2e/ios-settings-visual.spec.ts",
      "--project",
      "chromium",
    ],
  },
];

function runStep(label, command) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${command.join(" ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const step of steps) {
  runStep(step.label, step.command);
}

console.log("\nAll iOS Settings compliance gates passed.");
