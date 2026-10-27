import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensurePrimaryContact } from "@/lib/contacts";
import { normalizeUrl } from "@/lib/urls";
import { cleanTags } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const search = searchParams.get("search")?.trim();

    const contacts = await db.contact.findMany({
      where: {
        AND: [
          companyId
            ? { OR: [{ companyId }, { affiliations: { some: { companyId } } }] }
            : {},
          search
            ? {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  { title: { contains: search, mode: "insensitive" } },
                  { location: { contains: search, mode: "insensitive" } },
                  { company: { name: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {},
        ],
      },
      include: {
        company: { select: { id: true, name: true, companyType: true } },
        affiliations: { include: { company: { select: { id: true, name: true, companyType: true } } } },
        interactions: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        _count: { select: { interactions: true } },
      },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
    });

    return NextResponse.json(
      contacts.map(({ interactions, ...c }) => ({ ...c, lastInteractionAt: interactions[0]?.date ?? null }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName, lastName, title, email, linkedinUrl, phone, location,
      relationship, notes, isPrimary, newCompany, role,
    } = body;
    const contactTypes = cleanTags(body.contactTypes);
    let { companyId } = body;

    if (!firstName || !lastName || (!companyId && !newCompany?.name)) {
      return NextResponse.json({ error: "firstName, lastName and a company are required" }, { status: 400 });
    }

    if (!companyId) {
      const name = String(newCompany.name).trim();
      const existing = await db.company.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      companyId = existing?.id ?? (await db.company.create({
        data: {
          name,
          companyType: newCompany.companyType ?? "OPERATING_COMPANY",
          priority: "UNKNOWN",
        },
      })).id;
    }

    // Same person already in the system (matched by email): link them to
    // this company instead of creating a duplicate record.
    const normalizedEmail = typeof email === "string" && email.trim() ? email.trim() : null;
    if (normalizedEmail) {
      const existing = await db.contact.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });
      if (existing) {
        if (existing.companyId !== companyId) {
          await db.contactAffiliation.upsert({
            where: { contactId_companyId: { contactId: existing.id, companyId } },
            create: { contactId: existing.id, companyId, role: role ?? title ?? null },
            update: {},
          });
        }
        if (contactTypes.length) {
          const merged = cleanTags([...existing.contactTypes, ...contactTypes]);
          await db.contact.update({ where: { id: existing.id }, data: { contactTypes: merged } });
          existing.contactTypes = merged;
        }
        return NextResponse.json({ ...existing, linkedExisting: true }, { status: 200 });
      }
    }

    const contact = await db.contact.create({
      data: {
        firstName, lastName, title, email: normalizedEmail, linkedinUrl: normalizeUrl(linkedinUrl), phone, location, notes,
        relationship: relationship ?? "UNKNOWN",
        contactTypes,
        isPrimary: false,
        companyId,
      },
    });
    await ensurePrimaryContact(db, companyId, isPrimary ? contact.id : undefined);

    const saved = await db.contact.findUnique({ where: { id: contact.id } });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
