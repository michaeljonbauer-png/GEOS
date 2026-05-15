import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await db.huntSession.findMany({
      where: { type: "SCOUT" },
      select: { id: true, query: true, resultCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, results } = await req.json() as { query: string; results: unknown[] };
    await db.huntSession.create({
      data: { type: "SCOUT", query, results: JSON.stringify(results), resultCount: results.length },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // non-fatal
  }
}
