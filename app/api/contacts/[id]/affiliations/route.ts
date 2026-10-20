import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Link a contact to an additional company (board seat, investor, banker, former role).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { companyId, role } = await request.json();
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

    const contact = await db.contact.findUnique({ where: { id: params.id } });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    if (contact.companyId === companyId) {
      return NextResponse.json({ error: "That is already this contact's current company" }, { status: 400 });
    }

    const affiliation = await db.contactAffiliation.upsert({
      where: { contactId_companyId: { contactId: params.id, companyId } },
      create: { contactId: params.id, companyId, role: role || null },
      update: { role: role || null },
    });
    return NextResponse.json(affiliation, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to link company" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = new URL(request.url).searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    await db.contactAffiliation.deleteMany({ where: { contactId: params.id, companyId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to unlink company" }, { status: 500 });
  }
}
