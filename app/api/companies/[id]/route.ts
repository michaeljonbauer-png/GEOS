import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const company = await db.company.findUnique({
      where: { id: params.id },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
        interactions: {
          orderBy: { date: "desc" },
          include: { contact: true },
          take: 50,
        },
        scoreDetails: {
          include: { criterion: true },
          orderBy: { criterion: { order: "asc" } },
        },
        notes: { orderBy: { createdAt: "desc" } },
        companyTags: { include: { tag: true } },
        feedback: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name, website, description, sector, subSector, geography,
      arrEstimate, arrGrowth, nrrEstimate, grossMargin, employees,
      founded, stage, status, priority, source, linkedinUrl, crunchbaseUrl,
    } = body;

    const company = await db.company.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(sector !== undefined && { sector }),
        ...(subSector !== undefined && { subSector }),
        ...(geography !== undefined && { geography }),
        ...(arrEstimate !== undefined && { arrEstimate: arrEstimate ? Number(arrEstimate) : null }),
        ...(arrGrowth !== undefined && { arrGrowth: arrGrowth ? Number(arrGrowth) : null }),
        ...(nrrEstimate !== undefined && { nrrEstimate: nrrEstimate ? Number(nrrEstimate) : null }),
        ...(grossMargin !== undefined && { grossMargin: grossMargin ? Number(grossMargin) : null }),
        ...(employees !== undefined && { employees: employees ? Number(employees) : null }),
        ...(founded !== undefined && { founded: founded ? Number(founded) : null }),
        ...(stage !== undefined && { stage }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(source !== undefined && { source }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(crunchbaseUrl !== undefined && { crunchbaseUrl }),
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.company.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}
