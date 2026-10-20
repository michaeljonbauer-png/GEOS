import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contact = await db.contact.findUnique({
      where: { id: params.id },
      include: {
        company: { select: { id: true, name: true, companyType: true, status: true, sector: true } },
        affiliations: {
          include: { company: { select: { id: true, name: true, companyType: true, status: true, sector: true } } },
          orderBy: { createdAt: "desc" },
        },
        interactions: {
          include: { company: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        },
      },
    });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    return NextResponse.json(contact);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      firstName, lastName, title, email, linkedinUrl, phone, location,
      relationship, notes, isPrimary, companyId,
    } = body;

    const current = await db.contact.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Changing current company = job move. Keep the old employer linked as
    // a former role, and drop any affiliation that's now the current one.
    if (companyId && companyId !== current.companyId) {
      await db.$transaction([
        db.contactAffiliation.upsert({
          where: { contactId_companyId: { contactId: current.id, companyId: current.companyId } },
          create: {
            contactId: current.id,
            companyId: current.companyId,
            role: current.title ? `Former ${current.title}` : "Former employee",
          },
          update: {},
        }),
        db.contactAffiliation.deleteMany({ where: { contactId: current.id, companyId } }),
      ]);
    }

    const contact = await db.contact.update({
      where: { id: params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(title !== undefined && { title }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
        ...(relationship !== undefined && { relationship }),
        ...(notes !== undefined && { notes }),
        ...(isPrimary !== undefined && { isPrimary }),
        ...(companyId && { companyId, isPrimary: false }),
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.$transaction([
      db.interaction.updateMany({ where: { contactId: params.id }, data: { contactId: null } }),
      db.contact.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
