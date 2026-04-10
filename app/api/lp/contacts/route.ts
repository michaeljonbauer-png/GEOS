import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const contacts = await db.lPContact.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const { name, firm, email, phone, commitment, type, notes } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const contact = await db.lPContact.create({
    data: { name, firm: firm ?? null, email: email ?? null, phone: phone ?? null, commitment: commitment ? parseFloat(commitment) : null, type: type ?? "LP", notes: notes ?? null },
  });
  return NextResponse.json(contact);
}
