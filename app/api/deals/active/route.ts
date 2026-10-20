import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Live deals: anything in Due Diligence, plus active conversations where
// diligence or term work has already started.
export async function GET() {
  const companies = await db.company.findMany({
    where: {
      OR: [
        { status: "DUE_DILIGENCE" },
        {
          status: "IN_CONVERSATION",
          OR: [{ diligenceTasks: { some: {} } }, { dealTerms: { some: {} } }],
        },
      ],
    },
    include: {
      diligenceTasks: { orderBy: [{ workstream: "asc" }, { order: "asc" }] },
      dealTerms: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      contacts: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(companies);
}
