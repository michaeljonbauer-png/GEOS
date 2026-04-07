import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, companyId } = body;

    if (!content || !companyId) {
      return NextResponse.json({ error: "content and companyId required" }, { status: 400 });
    }

    const note = await db.note.create({
      data: { content, companyId },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
