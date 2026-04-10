import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/companies/[id]/sources
// Returns all field sources as a map: { fieldName: { sourceLabel, sourceUrl, capturedAt } }
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sources = await db.companyFieldSource.findMany({
      where: { companyId: params.id },
    });
    const map: Record<string, { sourceLabel: string; sourceUrl: string | null; capturedAt: string }> = {};
    for (const s of sources) {
      map[s.field] = {
        sourceLabel: s.sourceLabel,
        sourceUrl: s.sourceUrl,
        capturedAt: s.capturedAt.toISOString(),
      };
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}

// PUT /api/companies/[id]/sources
// Body: { field: string, sourceLabel: string, sourceUrl?: string }
// Upserts a single field source (one source per field per company)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { field, sourceLabel, sourceUrl } = await request.json();
    if (!field || !sourceLabel) {
      return NextResponse.json({ error: "field and sourceLabel are required" }, { status: 400 });
    }
    const source = await db.companyFieldSource.upsert({
      where: { companyId_field: { companyId: params.id, field } },
      create: { companyId: params.id, field, sourceLabel, sourceUrl: sourceUrl ?? null },
      update: { sourceLabel, sourceUrl: sourceUrl ?? null, capturedAt: new Date() },
    });
    return NextResponse.json(source);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save source" }, { status: 500 });
  }
}

// DELETE /api/companies/[id]/sources?field=arrEstimate
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const field = request.nextUrl.searchParams.get("field");
    if (!field) return NextResponse.json({ error: "field is required" }, { status: 400 });
    await db.companyFieldSource.deleteMany({
      where: { companyId: params.id, field },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
  }
}
