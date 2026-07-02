import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  id: "default",
  businessModel: "B2B",
  endMarkets: "[]",
  softwareType: "",
  targetStages: "[]",
  minArrM: null,
  maxArrM: null,
  minEmployees: null,
  maxEmployees: null,
  maxFundingM: null,
  minFoundedYear: null,
  maxFoundedYear: null,
  additionalNotes: "",
};

export async function GET() {
  try {
    const prefs = await db.sourcingPreferences.upsert({
      where: { id: "default" },
      create: DEFAULTS,
      update: {},
    });
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const prefs = await db.sourcingPreferences.upsert({
    where: { id: "default" },
    create: { id: "default", ...body },
    update: body,
  });
  return NextResponse.json(prefs);
}
