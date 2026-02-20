import { NextResponse } from "next/server";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";

type Ctx = { params: Promise<{ planId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { planId } = await ctx.params;

    const body = await req.json();
    const userId = body.userId;
    const week = Number(body.week);
    const day = Number(body.day);

    if (!userId || !Number.isFinite(week) || !Number.isFinite(day)) {
      return NextResponse.json(
        { error: "userId, week, day are required" },
        { status: 400 },
      );
    }

    const session = await generateAndSaveSession({
      userId,
      planId,
      week,
      day,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", detail: String(e) },
      { status: 500 },
    );
  }
}
