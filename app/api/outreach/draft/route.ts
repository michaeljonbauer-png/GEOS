import { NextRequest, NextResponse } from "next/server";
import { draftOutreach } from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      companyName,
      companyDescription,
      sector,
      arrEstimate,
      arrGrowth,
      contactName,
      contactTitle,
      investorName,
      firmName,
      customContext,
    } = body;

    if (!type || !companyName) {
      return NextResponse.json({ error: "type and companyName required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-anthropic-api-key-here") {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured. Add your key to .env to enable AI drafting." },
        { status: 503 }
      );
    }

    const result = await draftOutreach({
      type,
      companyName,
      companyDescription,
      sector,
      arrEstimate,
      arrGrowth,
      contactName,
      contactTitle,
      investorName,
      firmName,
      customContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to draft outreach" }, { status: 500 });
  }
}
