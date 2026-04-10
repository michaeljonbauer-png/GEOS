import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const contacts = await db.contact.findMany({
      where: companyId ? { companyId } : {},
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, title, email, linkedinUrl, isPrimary, companyId } = body;

    if (!firstName || !lastName || !companyId) {
      return NextResponse.json({ error: "firstName, lastName, companyId required" }, { status: 400 });
    }

    const contact = await db.contact.create({
      data: { firstName, lastName, title, email, linkedinUrl, isPrimary: isPrimary ?? false, companyId },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
