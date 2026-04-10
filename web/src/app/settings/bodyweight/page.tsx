import { getSettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";
import { BodyweightPageContent } from "./bodyweight-page-content";

export default async function SettingsBodyweightPage() {
  const snapshot = await getSettingsSnapshot();
  return <BodyweightPageContent initialSnapshot={snapshot} />;
}
