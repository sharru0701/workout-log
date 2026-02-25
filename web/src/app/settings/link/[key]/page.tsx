import { redirect } from "next/navigation";
import { SettingsDeepLinkInvalidView } from "@/components/ui/settings-deeplink-invalid";
import { resolveSettingsDeepLink } from "@/lib/settings/settings-deeplink";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export default async function SettingsDeepLinkKeyPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const route = await params;
  const sp = searchParams ? await searchParams : {};

  let key = route.key;
  try {
    key = decodeURIComponent(route.key);
  } catch {
    key = route.key;
  }

  const row = readString(sp, "row");
  const resolved = resolveSettingsDeepLink({ key, row });

  if (resolved.ok) {
    redirect(resolved.target);
  }

  return (
    <SettingsDeepLinkInvalidView
      errorCode={resolved.errorCode}
      requestedKey={resolved.key}
      requestedRow={resolved.row}
    />
  );
}
