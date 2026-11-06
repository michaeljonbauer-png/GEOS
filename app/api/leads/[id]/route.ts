import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/leads/[id] — add a lead to Companies (as Identified) or pass on it
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { action, notes } = await req.json() as { action: "pursue" | "save" | "pass"; notes?: string };

  const keep = action === "pursue" || action === "save";
  const newStatus = keep ? "IDENTIFIED" : "PASSED";

  const company = await db.company.update({
    where: { id: params.id },
    data: { status: newStatus },
  });

  // Record feedback signal so future lead generation can learn from it
  const signal = keep ? "INTERESTED" : "PASS";
  const existing = await db.companyFeedback.findFirst({ where: { companyId: params.id } });
  if (existing) {
    await db.companyFeedback.update({
      where: { id: existing.id },
      data: { signal, notes: notes ?? existing.notes, source: "leads" },
    });
  } else {
    await db.companyFeedback.create({
      data: { companyId: params.id, signal, notes: notes ?? null, source: "leads" },
    });
  }

  return NextResponse.json(company);
}
