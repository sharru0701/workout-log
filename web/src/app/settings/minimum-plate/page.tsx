import { getSettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";
import { fetchExercisesServer } from "@/server/services/program-store/get-program-store-page-bootstrap";
import { MinimumPlatePageContent } from "./minimum-plate-page-content";

export default async function SettingsMinimumPlatePage() {
  const [snapshot, exercises] = await Promise.all([
    getSettingsSnapshot(),
    fetchExercisesServer(),
  ]);
  return <MinimumPlatePageContent initialSnapshot={snapshot} initialExercises={exercises} />;
}
