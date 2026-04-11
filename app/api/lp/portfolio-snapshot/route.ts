import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns a fund-level snapshot for auto-populating LP updates
export async function GET() {
  const companies = await db.company.findMany({
    where: { status: { in: ["INVESTED", "MONITORING"] } },
    include: {
      investment: true,
      kpiSnapshots: { orderBy: { period: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const totalDeployed = companies.reduce((s, c) => s + (c.investment?.investedAmount ?? 0), 0);
  const totalCurrentVal = companies.reduce((s, c) => s + (c.investment?.currentValuation ?? 0), 0);
  const totalReserves = companies.reduce((s, c) => s + (c.investment?.reserveAmount ?? 0), 0);
  const tvpi = totalDeployed > 0 ? totalCurrentVal / totalDeployed : null;

  return NextResponse.json({
    numCompanies: companies.length,
    totalDeployed,
    totalCurrentVal,
    totalReserves,
    tvpi,
    companies: companies.map((c) => ({
      name: c.name,
      sector: c.sector,
      status: c.status,
      arrEstimate: c.arrEstimate,
      arrGrowth: c.arrGrowth,
      nrrEstimate: c.nrrEstimate,
      investment: c.investment
        ? {
            investedAmount: c.investment.investedAmount,
            ownershipPct: c.investment.ownershipPct,
            moic: c.investment.moic,
            currentValuation: c.investment.currentValuation,
          }
        : null,
      latestKPI: c.kpiSnapshots[0] ?? null,
    })),
  });
}
