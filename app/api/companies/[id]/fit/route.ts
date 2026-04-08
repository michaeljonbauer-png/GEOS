import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeThesisFit, type CompanySnapshot, type ThesisCriterion } from "@/lib/thesis";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [company, criteria] = await Promise.all([
      db.company.findUnique({ where: { id: params.id } }),
      db.thesisCriterion.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { order: "asc" }],
      }),
    ]);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const snapshot = company as unknown as CompanySnapshot;
    const fit = computeThesisFit(snapshot, criteria as ThesisCriterion[]);

    // Cache the fit score on the company
    if (fit.score !== null || fit.failedFilters.length > 0) {
      await db.company.update({
        where: { id: params.id },
        data: { thesisFitScore: fit.hardFilterPass ? fit.score : -1 },
      });
    }

    return NextResponse.json(fit);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to compute thesis fit" }, { status: 500 });
  }
}
