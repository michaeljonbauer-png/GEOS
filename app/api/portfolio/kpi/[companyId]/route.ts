import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const snapshots = await db.portfolioKPISnapshot.findMany({
    where: { companyId: params.companyId },
    orderBy: { period: "desc" },
  });
  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const body = await req.json();
  const coerce = (v: unknown, int = false) => (v === null || v === undefined || v === "") ? null : int ? parseInt(String(v)) : parseFloat(String(v));
  const data = {
    period:      body.period,
    arr:         coerce(body.arr),
    arrGrowth:   coerce(body.arrGrowth),
    nrr:         coerce(body.nrr),
    grossMargin: coerce(body.grossMargin),
    employees:   coerce(body.employees, true),
    burn:        coerce(body.burn),
    runway:      coerce(body.runway, true),
    notes:       body.notes ?? null,
  };
  const snap = await db.portfolioKPISnapshot.upsert({
    where: { companyId_period: { companyId: params.companyId, period: body.period } },
    create: { companyId: params.companyId, ...data },
    update: data,
  });
  return NextResponse.json(snap);
}
