import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const sector = searchParams.get("sector");
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

    const companies = await db.company.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: search } },
                  { description: { contains: search } },
                  { sector: { contains: search } },
                ],
              }
            : {},
          status ? { status } : {},
          sector ? { sector } : {},
        ],
      },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        feedback: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { interactions: true, contacts: true } },
      },
      orderBy: { [sortBy]: sortDir },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, website, description, sector, subSector, geography,
      arrEstimate, arrGrowth, nrrEstimate, grossMargin, employees,
      founded, stage, status, priority, source, linkedinUrl, crunchbaseUrl,
      totalFundingM, recommendationScore, recommendationRationale,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const company = await db.company.create({
      data: {
        name, website, description, sector, subSector, geography,
        totalFundingM: totalFundingM ? Number(totalFundingM) : null,
        arrEstimate: arrEstimate ? Number(arrEstimate) : null,
        arrGrowth: arrGrowth ? Number(arrGrowth) : null,
        nrrEstimate: nrrEstimate ? Number(nrrEstimate) : null,
        grossMargin: grossMargin ? Number(grossMargin) : null,
        employees: employees ? Number(employees) : null,
        founded: founded ? Number(founded) : null,
        stage, status: status ?? "IDENTIFIED",
        priority: priority ?? "MEDIUM",
        source, linkedinUrl, crunchbaseUrl,
        recommendationScore: recommendationScore != null ? Number(recommendationScore) : null,
        recommendationRationale: recommendationRationale ?? null,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
