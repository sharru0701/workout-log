import { getSettingsSnapshot } from "@/server/services/settings/get-settings-snapshot";
import { LanguagePageContent } from "./language-page-content";

export default async function SettingsLanguagePage() {
  const snapshot = await getSettingsSnapshot();
  return <LanguagePageContent initialSnapshot={snapshot} />;
}
