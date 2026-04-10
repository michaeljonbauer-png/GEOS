import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const updates = await db.lPUpdate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(updates);
}

export async function POST(req: NextRequest) {
  const { period, title, body: body_ } = await req.json();
  if (!period || !title) return NextResponse.json({ error: "period and title required" }, { status: 400 });
  const update = await db.lPUpdate.create({ data: { period, title, body: body_ ?? "" } });
  return NextResponse.json(update);
}
