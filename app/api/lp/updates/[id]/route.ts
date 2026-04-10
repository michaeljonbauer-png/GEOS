import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const update = await db.lPUpdate.findUnique({ where: { id: params.id } });
  if (!update) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(update);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.body !== undefined) data.body = body.body;
  if (body.period !== undefined) data.period = body.period;
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "SENT") data.sentAt = new Date();
  }
  const update = await db.lPUpdate.update({ where: { id: params.id }, data });
  return NextResponse.json(update);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.lPUpdate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
