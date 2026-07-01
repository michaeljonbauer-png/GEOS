import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const handle = new URL(req.url).searchParams.get("handle");
    if (!handle) return NextResponse.json({ profile: null });
    const profile = await db.investorProfile.findUnique({ where: { handle } });
    return NextResponse.json({ profile: profile ?? null });
  } catch {
    return NextResponse.json({ profile: null });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.handle?.trim()) {
      return NextResponse.json({ error: "Handle is required." }, { status: 400 });
    }
    const data = {
      handle:       body.handle.trim(),
      minArrM:      body.minArrM != null ? Number(body.minArrM) : null,
      maxArrM:      body.maxArrM != null ? Number(body.maxArrM) : null,
      minYoyGrowth: body.minYoyGrowth != null ? Number(body.minYoyGrowth) : null,
      maxRaisedM:   body.maxRaisedM != null ? Number(body.maxRaisedM) : null,
      minGdr:       body.minGdr != null ? Number(body.minGdr) : null,
      minNdr:       body.minNdr != null ? Number(body.minNdr) : null,
      verticals:    typeof body.verticals === "string" ? body.verticals : JSON.stringify(body.verticals ?? []),
      notes:        body.notes || null,
    };
    const profile = await db.investorProfile.upsert({
      where:  { handle: data.handle },
      create: data,
      update: data,
    });
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
