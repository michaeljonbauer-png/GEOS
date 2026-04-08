import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const feedback = await db.companyFeedback.findMany({
      where: companyId ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true, sector: true, arrEstimate: true, employees: true, founded: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, signal, notes, source } = body;

    if (!companyId || !signal) {
      return NextResponse.json({ error: "companyId and signal required" }, { status: 400 });
    }

    // Upsert — one feedback record per company (overwrite previous)
    const existing = await db.companyFeedback.findFirst({ where: { companyId } });

    let feedback;
    if (existing) {
      feedback = await db.companyFeedback.update({
        where: { id: existing.id },
        data: { signal, notes: notes ?? existing.notes, source },
      });
    } else {
      feedback = await db.companyFeedback.create({
        data: { companyId, signal, notes, source },
      });
    }

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
