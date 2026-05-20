import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const underwrite = await db.underwrite.findUnique({
      where: { shareToken: params.token },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            sector: true,
            arrEstimate: true,
            arrGrowth: true,
            nrrEstimate: true,
            grossMargin: true,
            employees: true,
            founded: true,
            stage: true,
            website: true,
          },
        },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!underwrite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(underwrite);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
