import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Toggle interest — returns new state
export async function POST(req: NextRequest) {
  try {
    const { dealId, handle } = await req.json() as { dealId: string; handle: string };
    if (!dealId || !handle) {
      return NextResponse.json({ error: "dealId and handle required." }, { status: 400 });
    }
    const existing = await db.dealInterest.findUnique({
      where: { dealId_handle: { dealId, handle } },
    });
    if (existing) {
      await db.dealInterest.delete({ where: { id: existing.id } });
      return NextResponse.json({ interested: false });
    } else {
      await db.dealInterest.create({ data: { dealId, handle } });
      return NextResponse.json({ interested: true });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
