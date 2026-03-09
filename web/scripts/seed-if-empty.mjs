import { syncSeedIfNeeded } from "./seed-if-needed.mjs";

syncSeedIfNeeded().catch((error) => {
  console.error("[seed-sync] failed", error);
  process.exit(1);
});
