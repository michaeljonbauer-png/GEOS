import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Companies in active deal stages — Meeting Scheduled → Due Diligence
const DEAL_STATUSES = ["MEETING_SCHEDULED", "DUE_DILIGENCE"];

export async function GET() {
  const companies = await db.company.findMany({
    where: { status: { in: DEAL_STATUSES } },
    include: {
      diligenceTasks: { orderBy: [{ workstream: "asc" }, { order: "asc" }] },
      dealTerms: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      contacts: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(companies);
}
