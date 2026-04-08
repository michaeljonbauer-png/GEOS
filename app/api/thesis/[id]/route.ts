import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name, description, category, dataType,
      companyField, minValue, maxValue, unit,
      boolField, boolTarget, importance, notes, order, isActive,
    } = body;

    const criterion = await db.thesisCriterion.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(dataType !== undefined && { dataType }),
        ...(companyField !== undefined && { companyField }),
        ...(minValue !== undefined && { minValue: minValue !== null ? Number(minValue) : null }),
        ...(maxValue !== undefined && { maxValue: maxValue !== null ? Number(maxValue) : null }),
        ...(unit !== undefined && { unit }),
        ...(boolField !== undefined && { boolField }),
        ...(boolTarget !== undefined && { boolTarget }),
        ...(importance !== undefined && { importance: Number(importance) }),
        ...(notes !== undefined && { notes }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(criterion);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update thesis criterion" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.thesisCriterion.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete thesis criterion" }, { status: 500 });
  }
}
