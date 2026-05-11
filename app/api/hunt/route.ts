import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const sessions = await db.huntSession.findMany({
      select: { id: true, query: true, resultCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}

function isRateLimitError(err: unknown) {
  const status = (err as { status?: number }).status;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 429 || /rate.?limit/i.test(msg);
}

function isBillingError(err: unknown) {
  const status = (err as { status?: number }).status;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 402 || /credit balance/i.test(msg);
}

function arrFloor(totalFundingM: number | null, employees: number | null): number | null {
  const a = totalFundingM != null ? totalFundingM / 5 : null;
  const b = employees != null ? employees * 0.25 : null;
  const vals = [a, b].filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : null;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  const { query, count = 6 } = await req.json() as { query: string; count?: number };
  if (!query?.trim()) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Load thesis + existing pipeline as background context
    const [thesisCriteria, existingCompanies] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

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

    const existingNames = existingCompanies.map(c => c.name).join(", ") || "None";
    const today = new Date().toISOString().slice(0, 10);

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are helping a growth equity investor run a targeted company hunt. Today: ${today}.

INVESTOR'S HUNT QUERY:
"${query.trim()}"

INVESTOR'S STANDING THESIS (use as background context — the query may refine or expand on this):
${thesisSummary || "No specific thesis criteria set."}

SKIP — already in pipeline:
${existingNames}

Find exactly ${Math.min(count, 10)} companies that best match the hunt query. Requirements:
- EXCLUDE: acquired companies, PE-owned/controlled, publicly traded, roll-up subsidiaries
- Be specific and concrete — name real companies that exist, not hypothetical examples
- Apply ARR estimation rules: MAX(employees×$250K, totalFunding÷5, stage floor)
  Stage floors: Seed $0.5M | A $3M | B $12M | C $25M | D+ $50M

Return ONLY a JSON array:
[{
  "name": "Company Name",
  "website": "https://...",
  "sector": "B2B SaaS",
  "subSector": "e.g. Manufacturing Execution Systems",
  "geography": "City, State",
  "founded": 2021,
  "description": "2-3 sentences on what they do and what makes it differentiated",
  "stage": "Series A",
  "totalFundingM": 8.5,
  "employees": 45,
  "arrEstimate": 4.2,
  "arrGrowth": 85,
  "nrrEstimate": 115,
  "grossMargin": 72,
  "acquired": false,
  "acquiredBy": null,
  "huntRationale": "2-3 sentences: why this company matches the hunt query specifically",
  "huntScore": 88,
  "source": "Training knowledge — verify via Refresh"
}]`,
      }],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n");

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "No results returned. Try rephrasing your query." }, { status: 500 });
    }

    type HuntResult = {
      name: string; website?: string; sector?: string; subSector?: string;
      geography?: string; founded?: number; description?: string;
      stage?: string; totalFundingM?: number | null; employees?: number | null;
      arrEstimate?: number | null; arrGrowth?: number | null;
      nrrEstimate?: number | null; grossMargin?: number | null;
      acquired?: boolean; acquiredBy?: string | null;
      huntRationale?: string; huntScore?: number | null; source?: string;
    };

    let results: HuntResult[] = JSON.parse(match[0]);

    // Filter acquired and apply ARR floors server-side
    results = results
      .filter(r => !r.acquired)
      .map(r => {
        const floor = arrFloor(r.totalFundingM ?? null, r.employees ?? null);
        if (floor != null && (r.arrEstimate == null || r.arrEstimate < floor)) {
          return { ...r, arrEstimate: Math.round(floor * 10) / 10 };
        }
        return r;
      });

    // Persist session — wrapped separately so a DB failure never blocks results
    try {
      await db.huntSession.create({
        data: { query: query.trim(), results: JSON.stringify(results), resultCount: results.length },
      });
    } catch (saveErr) {
      console.error("Hunt session save failed:", saveErr);
    }

    return NextResponse.json({ results, query: query.trim() });

  } catch (err) {
    if (isBillingError(err)) {
      return NextResponse.json(
        { error: "Anthropic credit balance too low. Add credits at console.anthropic.com." },
        { status: 402 }
      );
    }
    if (isRateLimitError(err)) {
      return NextResponse.json(
        { error: "Rate limit hit. Wait ~60 seconds and try again." },
        { status: 429 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Hunt error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
