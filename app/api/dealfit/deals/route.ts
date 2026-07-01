import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const deals = await db.sharedDeal.findMany({
      orderBy: { createdAt: "desc" },
      include: { interests: { select: { handle: true } } },
    });
    return NextResponse.json({ deals });
  } catch {
    return NextResponse.json({ deals: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.codeName?.trim()) {
      return NextResponse.json({ error: "Code name is required." }, { status: 400 });
    }
    const deal = await db.sharedDeal.create({
      data: {
        codeName:      body.codeName.trim(),
        vertical:      body.vertical ?? "",
        endMarket:     body.endMarket || null,
        description:   body.description || null,
        stage:         body.stage || null,
        arrM:          body.arrM != null ? Number(body.arrM) : null,
        yoyGrowth:     body.yoyGrowth != null ? Number(body.yoyGrowth) : null,
        totalRaisedM:  body.totalRaisedM != null ? Number(body.totalRaisedM) : null,
        ndr:           body.ndr != null ? Number(body.ndr) : null,
        gdr:           body.gdr != null ? Number(body.gdr) : null,
        ltmEbitdaM:    body.ltmEbitdaM != null ? Number(body.ltmEbitdaM) : null,
        customerCount: body.customerCount != null ? Number(body.customerCount) : null,
        acvK:          body.acvK != null ? Number(body.acvK) : null,
        status:        "ACTIVE",
      },
    });
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.sharedDeal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const deal = await db.sharedDeal.update({ where: { id }, data });
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
