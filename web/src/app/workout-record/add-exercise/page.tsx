import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export default async function WorkoutAddExercisePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const next = new URLSearchParams();
  next.set("openAdd", "1");

  const planId = readString(params, "planId");
  const date = readString(params, "date");
  if (planId) next.set("planId", planId);
  if (date) next.set("date", date);

  redirect(`/workout-record?${next.toString()}`);
}
