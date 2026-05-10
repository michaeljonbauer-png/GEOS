import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await db.huntSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...session, results: JSON.parse(session.results) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.huntSession.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
