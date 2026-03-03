import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export default async function ProgramCustomizeRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const program = readString(params, "program") ?? "";
  const query = new URLSearchParams();
  if (program) query.set("customize", program);
  redirect(`/program-store${query.toString() ? `?${query.toString()}` : ""}`);
}
