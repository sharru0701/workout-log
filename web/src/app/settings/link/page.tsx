import { redirect } from "next/navigation";
import { SettingsDeepLinkInvalidView } from "@/components/ui/settings-deeplink-invalid";
import { toSettingsDeepLinkHref } from "@/lib/settings/settings-deeplink";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export default async function SettingsDeepLinkEntryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const key = readString(params, "key") ?? readString(params, "k");
  const row = readString(params, "row");
  const source = readString(params, "source");

  if (key && key.trim()) {
    redirect(toSettingsDeepLinkHref({ key: key.trim(), row, source: source ?? "external" }));
  }

  return <SettingsDeepLinkInvalidView errorCode="missing_key" requestedKey={key} requestedRow={row} />;
}
