import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const underwrites = await db.underwrite.findMany({
      include: {
        company: {
          select: { id: true, name: true, sector: true, arrEstimate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(underwrites);
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, analystName } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const underwrite = await db.underwrite.create({
      data: {
        companyId,
        analystName: analystName ?? null,
      },
    });

    return NextResponse.json(underwrite, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create underwrite" }, { status: 500 });
  }
}
