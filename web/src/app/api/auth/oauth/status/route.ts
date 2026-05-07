import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { isGoogleOAuthConfigured } from "@/server/auth/oauth-google";

async function GETImpl(_req: Request) {
  void _req;
  return NextResponse.json({
    google: isGoogleOAuthConfigured(),
  });
}

export const GET = withApiLogging(GETImpl);
