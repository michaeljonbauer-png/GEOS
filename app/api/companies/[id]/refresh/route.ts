import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// Web search can take 30–90s per company
export const maxDuration = 180;

// POST /api/companies/[id]/refresh
// Uses Claude + web_search to triangulate CURRENT funding, headcount, and ARR
// estimates for a specific company, then updates the record in place and
// writes source provenance for each field updated.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 500 }
    );
  }

  const company = await db.company.findUnique({ where: { id: params.id } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `You are a research analyst updating a B2B SaaS company record with the latest public facts. Today is ${today}.

COMPANY: ${company.name}
${company.website ? `Website: ${company.website}` : ""}
${company.sector ? `Sector: ${company.sector}` : ""}
${company.subSector ? `Sub-sector: ${company.subSector}` : ""}

CURRENT RECORD (may be stale — your job is to verify and update):
- Stage: ${company.stage ?? "unknown"}
- Total funding raised: ${company.totalFundingM != null ? `$${company.totalFundingM}M` : "unknown"}
- Employees: ${company.employees ?? "unknown"}
- ARR estimate: ${company.arrEstimate != null ? `$${company.arrEstimate}M` : "unknown"}
- Founded: ${company.founded ?? "unknown"}
- Geography: ${company.geography ?? "unknown"}

RESEARCH INSTRUCTIONS — use up to 5 web searches, focused on what you're least certain about:
1. "${company.name} funding 2024 2025" — latest round, amount, stage, date.
2. "${company.name} employees headcount" — current team size (LinkedIn, Growjo, PitchBook public).
3. Only search for revenue/ARR if a public figure seems likely; otherwise triangulate:
   - Stage multiples: Seed ≈ $0.5–2M, Series A ≈ $3–8M, Series B ≈ $15–40M, Series C ≈ $40–100M+
   - Employee baseline: $200–400K ARR/employee for healthy B2B SaaS

OUTPUT FORMAT — return ONLY a JSON object (no prose, no markdown fences):
{
  "stage": "Series B" | null,
  "totalFundingM": <number in $M> | null,
  "employees": <number> | null,
  "arrEstimate": <number in $M> | null,
  "arrGrowth": <estimated YoY % growth> | null,
  "founded": <year> | null,
  "geography": "City, State" | null,
  "description": "updated 2-3 sentence description" | null,
  "sources": {
    "stage": "e.g. 'Series B $42.5M Apr 2025 (PR Newswire)'",
    "totalFundingM": "e.g. 'Crunchbase / PR Newswire Apr 2025'",
    "employees": "e.g. 'LinkedIn ~200 (Apr 2025)'",
    "arrEstimate": "e.g. 'Triangulated from Series B + 200 employees'",
    "arrGrowth": "e.g. 'Growjo YoY estimate'"
  },
  "confidence": "high" | "medium" | "low",
  "notes": "1-2 sentences summarizing what changed vs. the current record and why"
}

Only include fields where you found verifiable evidence or can triangulate with high confidence. Leave a field null if genuinely unknown — do NOT guess.`;

    // web_search is a server-side tool; SDK v0.32 types don't recognize it yet,
    // so we cast the tools array to bypass the client-tool typing.
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any,
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Refresh: no JSON in response:", rawText.slice(0, 500));
      return NextResponse.json({ error: "AI response did not contain JSON. Try again." }, { status: 500 });
    }

    let research: {
      stage?: string | null;
      totalFundingM?: number | null;
      employees?: number | null;
      arrEstimate?: number | null;
      arrGrowth?: number | null;
      founded?: number | null;
      geography?: string | null;
      description?: string | null;
      sources?: Record<string, string>;
      confidence?: string;
      notes?: string;
    };
    try {
      research = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Refresh JSON parse error:", e);
      return NextResponse.json({ error: "AI returned malformed JSON. Try again." }, { status: 500 });
    }

    // Only update fields we got a non-null value for
    const updates: Record<string, string | number | null> = {};
    const fieldMap: Array<[keyof typeof research, string]> = [
      ["stage", "stage"],
      ["totalFundingM", "totalFundingM"],
      ["employees", "employees"],
      ["arrEstimate", "arrEstimate"],
      ["arrGrowth", "arrGrowth"],
      ["founded", "founded"],
      ["geography", "geography"],
      ["description", "description"],
    ];

    for (const [key, dbField] of fieldMap) {
      const val = research[key];
      if (val != null && val !== "") {
        updates[dbField] = typeof val === "string" ? val : Number(val);
      }
    }

    const updated = await db.company.update({
      where: { id: params.id },
      data: updates,
    });

    // Write source attribution for each field we updated
    if (research.sources) {
      await Promise.all(
        Object.entries(research.sources).map(async ([field, label]) => {
          if (!label) return;
          // Only write source if we actually updated that field
          if (!(field in updates)) return;
          const sourceLabel = String(label).slice(0, 200);
          await db.companyFieldSource.upsert({
            where: { companyId_field: { companyId: params.id, field } },
            update: { sourceLabel, capturedAt: new Date() },
            create: { companyId: params.id, field, sourceLabel },
          });
        })
      );
    }

    return NextResponse.json({
      company: updated,
      changed: Object.keys(updates),
      confidence: research.confidence ?? null,
      notes: research.notes ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Refresh error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
