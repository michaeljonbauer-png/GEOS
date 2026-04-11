import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const leads = await db.company.findMany({
    where: { status: "LEAD" },
    orderBy: [{ recommendationScore: "desc" }, { recommendedAt: "desc" }],
  });
  return NextResponse.json(leads);
}
