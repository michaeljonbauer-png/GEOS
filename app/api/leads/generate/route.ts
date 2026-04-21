import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 9;
export const maxDuration = 300;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Route ──────────────────────────────────────────────────────────────────

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it in Railway → your service → Variables." },
      { status: 500 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const currentCount = await db.company.count({ where: { status: "LEAD" } });

    if (currentCount > QUEUE_TARGET) {
      const excess = await db.company.findMany({
        where: { status: "LEAD" },
        orderBy: [{ recommendationScore: "asc" }, { recommendedAt: "asc" }],
        take: currentCount - QUEUE_TARGET,
        select: { id: true },
      });
      await db.company.deleteMany({ where: { id: { in: excess.map(l => l.id) } } });
      return NextResponse.json({ generated: 0, message: "Trimmed queue to 9" });
    }

    const toGenerate = Math.max(0, QUEUE_TARGET - currentCount);
    if (toGenerate === 0) {
      return NextResponse.json({ generated: 0, message: "Queue is already full" });
    }

    // ── Context ──────────────────────────────────────────────────────────────
    const [thesisCriteria, existingCompanies, recentFeedback] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.companyFeedback.findMany({
        include: { company: { select: { name: true, sector: true, subSector: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const thesisSummary = thesisCriteria.map(t => {
      if (t.dataType === "RANGE" && t.companyField) {
        const parts = [t.minValue != null ? `min ${t.minValue}` : null, t.maxValue != null ? `max ${t.maxValue}` : null].filter(Boolean).join(", ");
        return `• ${t.name} [${t.category}]: ${t.companyField} — ${parts}${t.unit ? " " + t.unit : ""}`;
      }
      if (t.dataType === "BOOLEAN" && t.boolField) {
        return `• ${t.name} [${t.category}]: ${t.boolField} must be ${t.boolTarget}`;
      }
      return `• ${t.name} [${t.category}]: ${t.notes ?? t.description ?? "qualitative signal"}`;
    }).join("\n");

    const existingNames = existingCompanies.map(c => c.name).join(", ") || "None yet";
    const interested = recentFeedback.filter(f => ["INTERESTED", "HIGH_PRIORITY"].includes(f.signal));
    const passed = recentFeedback.filter(f => f.signal === "PASS");
    const feedbackSection = [
      interested.length > 0 ? `Liked: ${interested.map(f => f.company.name).join(", ")}` : "",
      passed.length > 0 ? `Passed: ${passed.map(f => f.company.name).join(", ")}` : "",
    ].filter(Boolean).join(" | ");

    const today = new Date().toISOString().slice(0, 10);

    // ══ PHASE 1: Select candidate names (no search, ~1K tokens) ═════════════
    type Candidate = { name: string; website?: string; sector?: string; subSector?: string; geography?: string; founded?: number; description?: string };
    let candidates: Candidate[] = [];

    try {
      const selMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        messages: [{
          role: "user",
          content: `Growth equity investor seeking B2B SaaS leads. Today: ${today}.

THESIS:
${thesisSummary}

SKIP (already in pipeline): ${existingNames}
${feedbackSection ? `FEEDBACK: ${feedbackSection}` : ""}

List exactly ${toGenerate} candidate companies. Prefer: vertical/industry software, B2B enterprise/mid-market, founded 2018–2023, 15–250 employees. EXCLUDE: acquired, PE-owned, public, roll-up subsidiaries.

JSON array only:
{"name":"","website":"","sector":"","subSector":"","geography":"","founded":0,"description":""}`,
        }],
      });

      const text = selMsg.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("\n");
      const match = text.match(/\[[\s\S]*\]/);
      if (match) candidates = JSON.parse(match[0]);
    } catch (selErr) {
      if (isBillingError(selErr)) {
        return NextResponse.json({ error: "Anthropic credit balance too low. Add credits at console.anthropic.com." }, { status: 402 });
      }
      if (isRateLimitError(selErr)) {
        return NextResponse.json({ error: "Rate limit hit. Wait ~60 seconds and try again." }, { status: 429 });
      }
      throw selErr;
    }

    if (!candidates.length) {
      return NextResponse.json({ error: "Candidate selection returned no companies. Try again." }, { status: 500 });
    }

    // ══ PHASE 2: Fact-finding via web search (NO thesis = small context per turn) ═
    // Keeping thesis out of this prompt is the key rate-limit fix:
    // prompt is ~400 tokens vs ~1400 tokens before, saving ~1000 tokens × N search turns.
    type FactData = {
      name: string; acquired?: boolean; acquiredBy?: string | null;
      stage?: string; totalFundingM?: number | null; employees?: number | null;
      arrEstimate?: number | null; arrGrowth?: number | null;
      source?: string;
    };
    let facts: FactData[] = [];
    let searchSucceeded = false;

    try {
      const factMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Research analyst. Today: ${today}.

For each company, do ONE search: "<name> acquired funding employees"
This single query surfaces acquisition news, latest funding, and headcount.

Companies:
${candidates.map((c, i) => `${i + 1}. ${c.name} (${c.website ?? "unknown"})`).join("\n")}

Return JSON array:
{
  "name": "Company Name",
  "acquired": <true if acquired/PE-owned/public/roll-up, false otherwise>,
  "acquiredBy": "name or null",
  "stage": "Series B",
  "totalFundingM": <total $M all rounds>,
  "employees": <current headcount>,
  "arrEstimate": <$M — MAX of: employees×0.25, totalFundingM÷5, stage floor (A=$3M B=$12M C=$25M)>,
  "arrGrowth": <YoY % estimate>,
  "source": "e.g. Series C $39M Apr 2025; 152 employees LinkedIn"
}

ACQUISITION: set acquired=true for: "acquired by", PE firm ownership, IPO, "subsidiary of", roll-up.
ARR floors: Seed $0.5M, A $3M, B $12M, C $25M, D+ $50M. >$80M raised → ≥$25M ARR.
JSON array only.`,
        }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(toGenerate, 6) }] as any,
      } as any);

      const factText = factMsg.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("\n");
      const factMatch = factText.match(/\[[\s\S]*\]/);
      if (factMatch) {
        facts = JSON.parse(factMatch[0]);
        searchSucceeded = true;
      }
    } catch (factErr) {
      if (isBillingError(factErr)) {
        return NextResponse.json({ error: "Anthropic credit balance too low. Add credits at console.anthropic.com." }, { status: 402 });
      }
      if (isRateLimitError(factErr)) {
        console.warn("Rate limited on fact-finding — will save candidates with formula-based estimates");
        // Fall through: facts stays empty, Phase 3 scoring still runs with candidate descriptions
      } else {
        console.warn("Fact-finding failed:", factErr instanceof Error ? factErr.message : String(factErr));
      }
    }

    const factMap = new Map(facts.map(f => [f.name.toLowerCase(), f]));

    // Drop acquired/PE/public companies
    const acquiredNames: string[] = [];
    const viable = candidates.slice(0, toGenerate).filter(c => {
      const f = factMap.get(c.name.toLowerCase());
      if (f?.acquired === true) {
        acquiredNames.push(`${c.name}${f.acquiredBy ? ` (→ ${f.acquiredBy})` : ""}`);
        return false;
      }
      return true;
    });
    if (acquiredNames.length) console.log(`Filtered acquired: ${acquiredNames.join(", ")}`);

    // ══ PHASE 3: Score against thesis (no search, bounded cost) ══════════════
    type ScoreData = {
      name: string;
      recommendationScore?: number;
      recommendationRationale?: string;
      scoreBreakdown?: Array<{ criterion: string; met: boolean; score: number; note: string }>;
    };
    let scores: ScoreData[] = [];

    // Build a compact company summary for the scoring prompt
    const companySummaries = viable.map(c => {
      const f = factMap.get(c.name.toLowerCase());
      const arr = f?.arrEstimate ?? null;
      const floor = arrFloor(f?.totalFundingM ?? null, f?.employees ?? null);
      const arrFinal = arr != null && floor != null ? Math.max(arr, floor) : arr ?? floor;
      return `${c.name}: ${c.description ?? ""} | Stage: ${f?.stage ?? "unknown"} | Funding: $${f?.totalFundingM ?? "?"}M | Employees: ${f?.employees ?? "?"} | ARR est: $${arrFinal?.toFixed(1) ?? "?"}M`;
    }).join("\n");

    if (viable.length > 0) {
      try {
        const scoreMsg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `Score these B2B SaaS companies against a growth equity thesis. No web search needed — use the data provided.

THESIS CRITERIA:
${thesisSummary}

COMPANIES (with verified facts):
${companySummaries}

For each company return a JSON array:
{
  "name": "Company Name",
  "recommendationScore": <0-100 weighted average>,
  "recommendationRationale": "2-3 sentences overall fit",
  "scoreBreakdown": [
    { "criterion": "exact criterion name", "met": true, "score": 0-100, "note": "1 sentence evidence" }
  ]
}

SCORING: score each criterion 0-100. met=true if clearly satisfied. recommendationScore = weighted avg (hard filter failures drag score below 50). Be honest — 2 of 5 criteria ≈ score 40.
JSON array only.`,
          }],
        });

        const scoreText = scoreMsg.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("\n");
        const scoreMatch = scoreText.match(/\[[\s\S]*\]/);
        if (scoreMatch) scores = JSON.parse(scoreMatch[0]);
      } catch (scoreErr) {
        if (isRateLimitError(scoreErr)) {
          console.warn("Rate limited on scoring — companies saved without breakdown");
        } else {
          console.warn("Scoring failed:", scoreErr instanceof Error ? scoreErr.message : String(scoreErr));
        }
      }
    }

    const scoreMap = new Map(scores.map(s => [s.name.toLowerCase(), s]));

    // ══ Save to DB ═══════════════════════════════════════════════════════════
    const now = new Date();
    const created = await Promise.all(
      viable.map(c => {
        const f = factMap.get(c.name.toLowerCase()) ?? {};
        const s = scoreMap.get(c.name.toLowerCase()) ?? {};
        const totalFundingM = (f as FactData).totalFundingM ?? null;
        const employees = (f as FactData).employees ?? null;

        let arrEstimate = (f as FactData).arrEstimate ?? null;
        const floor = arrFloor(totalFundingM ?? null, employees ?? null);
        if (floor != null && (arrEstimate == null || arrEstimate < floor)) {
          arrEstimate = Math.round(floor * 10) / 10;
        }

        const sd = (s as ScoreData).scoreBreakdown;

        return db.company.create({
          data: {
            name: c.name,
            website: c.website ?? null,
            description: c.description ?? null,
            sector: c.sector ?? null,
            subSector: c.subSector ?? null,
            geography: c.geography ?? null,
            founded: c.founded ?? null,
            stage: (f as FactData).stage ?? null,
            totalFundingM: totalFundingM ?? null,
            employees: employees ?? null,
            arrEstimate,
            arrGrowth: (f as FactData).arrGrowth ?? null,
            status: "LEAD",
            priority: "MEDIUM",
            source: (f as FactData).source
              ? String((f as FactData).source)
              : searchSucceeded ? "AI recommendation (web-verified)" : "AI recommendation",
            recommendationRationale: (s as ScoreData).recommendationRationale ?? null,
            recommendationScore: (s as ScoreData).recommendationScore ?? null,
            scoreBreakdown: Array.isArray(sd) && sd.length > 0 ? JSON.stringify(sd) : null,
            recommendedAt: now,
          },
        });
      })
    );

    return NextResponse.json({ generated: created.length, webSearchUsed: searchSucceeded, filtered: acquiredNames });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
