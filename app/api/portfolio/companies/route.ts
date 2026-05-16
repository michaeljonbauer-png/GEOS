import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns all companies with status INVESTED or MONITORING, with their
// investment record and latest KPI snapshot
export async function GET() {
  try {
    const companies = await db.company.findMany({
      where: { status: { in: ["INVESTED", "MONITORING"] } },
      include: {
        investment: true,
        kpiSnapshots: { orderBy: { period: "desc" }, take: 4 },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(companies);
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}
