import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/custom-fields/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.customFieldDef.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete field" }, { status: 500 });
  }
}

// PATCH /api/custom-fields/[id]  — rename or change unit
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name, unit } = await request.json();
    const field = await db.customFieldDef.update({
      where: { id: params.id },
      data: { name: name?.trim(), unit: unit?.trim() || null },
    });
    return NextResponse.json(field);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update field" }, { status: 500 });
  }
}
