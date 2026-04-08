import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const criteria = await db.thesisCriterion.findMany({
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
    return NextResponse.json(criteria);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch thesis" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, description, category, dataType,
      companyField, minValue, maxValue, unit,
      boolField, boolTarget, importance, notes, order,
    } = body;

    if (!name || !category || !dataType) {
      return NextResponse.json({ error: "name, category, dataType required" }, { status: 400 });
    }

    const maxOrder = await db.thesisCriterion.aggregate({ _max: { order: true } });
    const criterion = await db.thesisCriterion.create({
      data: {
        name,
        description,
        category,
        dataType,
        companyField,
        minValue: minValue !== undefined ? Number(minValue) : null,
        maxValue: maxValue !== undefined ? Number(maxValue) : null,
        unit,
        boolField,
        boolTarget,
        importance: importance ? Number(importance) : 3.0,
        notes,
        order: order ?? (maxOrder._max.order ?? 0) + 1,
      },
    });

    return NextResponse.json(criterion, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create thesis criterion" }, { status: 500 });
  }
}
