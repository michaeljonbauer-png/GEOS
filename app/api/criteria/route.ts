import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const criteria = await db.criterion.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json(criteria);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch criteria" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, weight, minThreshold, order } = body;

    if (!name || weight === undefined) {
      return NextResponse.json({ error: "name and weight required" }, { status: 400 });
    }

    const maxOrder = await db.criterion.aggregate({ _max: { order: true } });
    const criterion = await db.criterion.create({
      data: {
        name,
        description,
        weight: Number(weight),
        minThreshold: minThreshold ? Number(minThreshold) : 5.0,
        order: order ?? (maxOrder._max.order ?? 0) + 1,
      },
    });

    return NextResponse.json(criterion, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create criterion" }, { status: 500 });
  }
}
