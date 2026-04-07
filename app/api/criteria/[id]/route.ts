import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, weight, minThreshold, order, isActive } = body;

    const criterion = await db.criterion.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(weight !== undefined && { weight: Number(weight) }),
        ...(minThreshold !== undefined && { minThreshold: Number(minThreshold) }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(criterion);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update criterion" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.criterion.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete criterion" }, { status: 500 });
  }
}
