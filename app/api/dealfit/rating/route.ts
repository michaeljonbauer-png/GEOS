import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Upsert a rating; rating=0 removes it
export async function POST(req: NextRequest) {
  try {
    const { dealId, handle, rating } = await req.json() as {
      dealId: string; handle: string; rating: number;
    };
    if (!dealId || !handle) {
      return NextResponse.json({ error: "dealId and handle required." }, { status: 400 });
    }
    if (rating === 0) {
      await db.dealRating.deleteMany({ where: { dealId, handle } });
      return NextResponse.json({ rating: null });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
    }
    const result = await db.dealRating.upsert({
      where:  { dealId_handle: { dealId, handle } },
      create: { dealId, handle, rating },
      update: { rating },
    });
    return NextResponse.json({ rating: result.rating });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
