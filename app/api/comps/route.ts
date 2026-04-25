import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const comps = await db.comp.findMany({ orderBy: { dealDate: "desc" } });
    return NextResponse.json(comps);
  } catch {
    return NextResponse.json({ error: "Failed to fetch comps" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const comp = await db.comp.create({
      data: {
        companyName: body.companyName,
        buyer: body.buyer ?? null,
        dealDate: body.dealDate ? new Date(body.dealDate) : null,
        tev: body.tev != null ? Number(body.tev) : null,
        arr: body.arr != null ? Number(body.arr) : null,
        revenue: body.revenue != null ? Number(body.revenue) : null,
        grossMargin: body.grossMargin != null ? Number(body.grossMargin) : null,
        yoyGrowth: body.yoyGrowth != null ? Number(body.yoyGrowth) : null,
        ebitda: body.ebitda != null ? Number(body.ebitda) : null,
        gdr: body.gdr != null ? Number(body.gdr) : null,
        ndr: body.ndr != null ? Number(body.ndr) : null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json(comp, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create comp" }, { status: 500 });
  }
}
