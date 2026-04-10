import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const terms = await db.dealTerm.findMany({ where: { companyId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(terms);
}

export async function POST(req: NextRequest) {
  const { companyId, name, value, notes } = await req.json();
  if (!companyId || !name) return NextResponse.json({ error: "companyId, name required" }, { status: 400 });
  const term = await db.dealTerm.create({ data: { companyId, name, value: value ?? null, notes: notes ?? null } });
  return NextResponse.json(term);
}
