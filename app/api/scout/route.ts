import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  const { company } = await req.json() as { company: string };
  if (!company?.trim()) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Non-fatal if DB is unavailable — Scout still works, just without thesis context
    const thesisCriteria = await db.thesisCriterion.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }).catch(() => []);

    const thesisSummary = thesisCriteria.map(t => {
      if (t.dataType === "RANGE" && t.companyField) {
        const parts = [
          t.minValue != null ? `min ${t.minValue}` : null,
          t.maxValue != null ? `max ${t.maxValue}` : null,
        ].filter(Boolean).join(", ");
        return `• ${t.name}: ${t.companyField} ${parts}${t.unit ? " " + t.unit : ""}`;
      }
      if (t.dataType === "BOOLEAN" && t.boolField) {
        return `• ${t.name}: ${t.boolField} must be ${t.boolTarget}`;
      }
      return `• ${t.name}: ${t.notes ?? t.description ?? "qualitative signal"}`;
    }).join("\n");

    const today = new Date().toISOString().slice(0, 10);

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [{ name: "web_search", type: "web_search_20250305", max_uses: 3 } as any],
      messages: [{
        role: "user",
        content: `You are helping a growth equity investor research a specific company. Today: ${today}.

Research this company: "${company.trim()}"

Use web search to find current information about: what they do, recent funding, employee count, and growth signals.

INVESTOR THESIS — score this company against these criteria:
${thesisSummary || "No specific thesis criteria set."}

Return ONLY a single JSON object (no markdown, no explanation):
{
  "name": "exact company name",
  "website": "https://...",
  "sector": "B2B SaaS",
  "subSector": "specific niche",
  "geography": "City, State",
  "founded": 2020,
  "description": "2-3 sentences: what they do, who they serve, differentiation",
  "stage": "Series A",
  "totalFundingM": 12.5,
  "employees": 85,
  "arrEstimate": 8.0,
  "arrGrowth": 70,
  "acquired": false,
  "acquiredBy": null,
  "fitScore": 82,
  "fitRationale": "2-3 sentences: how well this fits the thesis and why",
  "founderName": "Jane Smith",
  "founderTitle": "Co-Founder & CEO",
  "founderLinkedIn": "https://linkedin.com/in/janesmith",
  "founderEmail": "jane@company.com",
  "source": "Web search — verified ${today}"
}

If the company cannot be found, return: { "notFound": true, "name": "${company.trim()}" }`,
      }],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: `No data returned for "${company}". Try again.` },
        { status: 500 }
      );
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(match[0]);
    } catch {
      return NextResponse.json(
        { error: `Could not parse research results for "${company}".` },
        { status: 500 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { error: `"${company}" could not be found. Check the spelling or try the full company name.` },
        { status: 404 }
      );
    }

    // Apply ARR floor server-side
    const totalFundingM = typeof result.totalFundingM === "number" ? result.totalFundingM : null;
    const employees = typeof result.employees === "number" ? result.employees : null;
    const a = totalFundingM != null ? totalFundingM / 5 : null;
    const b = employees != null ? employees * 0.25 : null;
    const vals = [a, b].filter((v): v is number => v != null);
    if (vals.length) {
      const floor = Math.max(...vals);
      const arrEstimate = typeof result.arrEstimate === "number" ? result.arrEstimate : null;
      if (floor > 0 && (arrEstimate == null || arrEstimate < floor)) {
        result.arrEstimate = Math.round(floor * 10) / 10;
      }
    }

    return NextResponse.json({ result });

  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 402 || /credit balance/i.test(msg)) {
      return NextResponse.json(
        { error: "Anthropic credit balance too low. Add credits at console.anthropic.com." },
        { status: 402 }
      );
    }
    if (status === 429 || /rate.?limit/i.test(msg)) {
      return NextResponse.json(
        { error: "Rate limit hit. Wait ~60 seconds and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
