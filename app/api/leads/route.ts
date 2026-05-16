import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leads = await db.company.findMany({
      where: { status: "LEAD" },
      orderBy: [{ recommendationScore: "desc" }, { recommendedAt: "desc" }],
    });
    return NextResponse.json(leads);
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}
