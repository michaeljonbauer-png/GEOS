import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await db.huntSession.findUnique({ where: { id: params.id } });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...session, results: JSON.parse(session.results) });
  } catch {
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.huntSession.delete({ where: { id: params.id } });
  } catch { /* already deleted or doesn't exist */ }
  return NextResponse.json({ ok: true });
}
