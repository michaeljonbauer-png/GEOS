import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/custom-fields/[id]/value
// Body: { companyId, value }
// Upserts the value for a specific field + company combination
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { companyId, value } = await request.json();
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    const record = await db.companyCustomValue.upsert({
      where: { fieldId_companyId: { fieldId: params.id, companyId } },
      create: { fieldId: params.id, companyId, value: value ?? null },
      update: { value: value ?? null },
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save value" }, { status: 500 });
  }
}
