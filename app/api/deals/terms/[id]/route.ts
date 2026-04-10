import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, value, notes } = await req.json();
  const term = await db.dealTerm.update({ where: { id: params.id }, data: { name, value: value ?? null, notes: notes ?? null } });
  return NextResponse.json(term);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.dealTerm.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
