import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VersionPayload = {
  ts: string;
  version: string;
  buildId: string;
  serviceWorkerUrl: string;
};

async function resolveBuildId() {
  const candidate =
    process.env.APP_BUILD_ID ??
    process.env.NEXT_BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "";
  if (candidate.trim().length > 0) return candidate.trim();

  const nextBuildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  const nextBuildId = await readFile(nextBuildIdPath, "utf8").catch(() => "");
  if (nextBuildId.trim().length > 0) return nextBuildId.trim();

  return process.env.NODE_ENV === "production" ? pkg.version ?? "unknown" : "dev";
}

async function GETImpl() {
  const buildId = await resolveBuildId();
  const payload: VersionPayload = {
    ts: new Date().toISOString(),
    version: process.env.APP_VERSION ?? pkg.version ?? "unknown",
    buildId,
    serviceWorkerUrl: `/sw.js?v=${encodeURIComponent(buildId)}`,
  };

  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const GET = withApiLogging(GETImpl);
