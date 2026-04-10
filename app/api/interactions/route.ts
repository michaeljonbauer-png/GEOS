import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const interactions = await db.interaction.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, title: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(interactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch interactions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, direction, subject, content, date, followUpDate, companyId, contactId } = body;

    if (!type || !companyId) {
      return NextResponse.json({ error: "type and companyId required" }, { status: 400 });
    }

    const interaction = await db.interaction.create({
      data: {
        type,
        direction: direction ?? "OUTBOUND",
        subject,
        content,
        date: date ? new Date(date) : new Date(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        companyId,
        contactId: contactId ?? null,
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create interaction" }, { status: 500 });
  }
}
