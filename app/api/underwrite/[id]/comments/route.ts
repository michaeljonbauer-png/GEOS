import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { section, authorName, content } = body;

    if (!section || !authorName || !content) {
      return NextResponse.json(
        { error: "section, authorName, and content are required" },
        { status: 400 }
      );
    }

    const comment = await db.underwriteComment.create({
      data: {
        underwriteId: params.id,
        section,
        authorName,
        content,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
