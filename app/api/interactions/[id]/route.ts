import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { subject, content, date, followUpDate, followUpDone, contactId } = body;

    const interaction = await db.interaction.update({
      where: { id: params.id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(content !== undefined && { content }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
        ...(followUpDone !== undefined && { followUpDone }),
        ...(contactId !== undefined && { contactId }),
      },
    });

    return NextResponse.json(interaction);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update interaction" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.interaction.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete interaction" }, { status: 500 });
  }
}
