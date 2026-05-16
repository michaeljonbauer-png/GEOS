import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeThesisFit, type CompanySnapshot, type ThesisCriterion } from "@/lib/thesis";

export const dynamic = "force-dynamic";

// Computes a thesis fit breakdown for an arbitrary company snapshot — no DB
// record required. Used by the Hunt/Scout detail view so a sourced company
// can be evaluated against the thesis before it is added to the pipeline.
export async function POST(req: NextRequest) {
  try {
    const company = await req.json() as CompanySnapshot;
    const criteria = await db.thesisCriterion.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
    const fit = computeThesisFit(company, criteria as ThesisCriterion[]);
    return NextResponse.json(fit);
  } catch (error) {
    console.error("thesis-fit error:", error);
    return NextResponse.json({ error: "Failed to compute thesis fit" }, { status: 500 });
  }
}
