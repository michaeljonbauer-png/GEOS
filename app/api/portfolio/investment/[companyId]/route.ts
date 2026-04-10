import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const inv = await db.portfolioInvestment.findUnique({ where: { companyId: params.companyId } });
  return NextResponse.json(inv ?? { companyId: params.companyId });
}

export async function PUT(req: NextRequest, { params }: { params: { companyId: string } }) {
  const body = await req.json();
  const coerce = (v: unknown) => (v === null || v === undefined || v === "") ? null : parseFloat(String(v));
  const data = {
    investedAmount:   coerce(body.investedAmount),
    ownershipPct:     coerce(body.ownershipPct),
    investmentDate:   body.investmentDate ? new Date(body.investmentDate) : null,
    roundType:        body.roundType ?? null,
    preMoneyVal:      coerce(body.preMoneyVal),
    currentValuation: coerce(body.currentValuation),
    proRataRights:    !!body.proRataRights,
    boardSeat:        !!body.boardSeat,
    leadInvestor:     !!body.leadInvestor,
    coInvestors:      body.coInvestors ?? null,
    reserveAmount:    coerce(body.reserveAmount),
    moic:             coerce(body.moic),
    notes:            body.notes ?? null,
  };
  const inv = await db.portfolioInvestment.upsert({
    where: { companyId: params.companyId },
    create: { companyId: params.companyId, ...data },
    update: data,
  });
  return NextResponse.json(inv);
}
