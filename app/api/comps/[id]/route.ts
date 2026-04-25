import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const comp = await db.comp.update({
      where: { id: params.id },
      data: {
        companyName: body.companyName,
        industry: body.industry ?? null,
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
    return NextResponse.json(comp);
  } catch {
    return NextResponse.json({ error: "Failed to update comp" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.comp.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comp" }, { status: 500 });
  }
}
