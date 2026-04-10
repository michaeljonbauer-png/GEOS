import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/custom-fields?companyId=xxx
// Returns all global fields + any company-specific fields for the given company
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  try {
    const fields = await db.customFieldDef.findMany({
      where: companyId
        ? { OR: [{ isGlobal: true }, { companyId }] }
        : { isGlobal: true },
      include: {
        values: companyId ? { where: { companyId } } : false,
      },
      orderBy: [{ isGlobal: "desc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(fields);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch custom fields" }, { status: 500 });
  }
}

// POST /api/custom-fields
// Body: { name, fieldType?, isGlobal, companyId?, unit? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, fieldType = "TEXT", isGlobal, companyId, unit } = body;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const field = await db.customFieldDef.create({
      data: {
        name: name.trim(),
        fieldType,
        isGlobal: !!isGlobal,
        companyId: isGlobal ? null : (companyId ?? null),
        unit: unit?.trim() || null,
      },
    });
    return NextResponse.json(field);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 });
  }
}
