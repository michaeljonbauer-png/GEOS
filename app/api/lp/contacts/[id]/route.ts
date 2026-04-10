import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const contact = await db.lPContact.update({
    where: { id: params.id },
    data: { name: body.name, firm: body.firm ?? null, email: body.email ?? null, phone: body.phone ?? null, commitment: body.commitment ? parseFloat(body.commitment) : null, type: body.type, notes: body.notes ?? null },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.lPContact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
