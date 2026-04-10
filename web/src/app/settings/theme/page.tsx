import { getSettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";
import { ThemePageContent } from "./theme-page-content";

export default async function SettingsThemePage() {
  const snapshot = await getSettingsSnapshot();
  return <ThemePageContent initialSnapshot={snapshot} />;
}
