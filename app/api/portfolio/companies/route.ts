import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Returns all companies with status INVESTED or MONITORING, with their
// investment record and latest KPI snapshot
export async function GET() {
  const companies = await db.company.findMany({
    where: { status: { in: ["INVESTED", "MONITORING"] } },
    include: {
      investment: true,
      kpiSnapshots: { orderBy: { period: "desc" }, take: 4 },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(companies);
}
