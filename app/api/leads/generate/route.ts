import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 10;

// Long-running: web search + multiple Claude turns can take 60–120s
export const maxDuration = 300;

export async function POST() {
  // Validate API key up front so we can return a clear error
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it in Railway → your service → Variables." },
      { status: 500 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // How many leads do we need to reach the target?
    const currentCount = await db.company.count({ where: { status: "LEAD" } });

    // Trim excess leads if somehow we ended up with more than the target
    if (currentCount > QUEUE_TARGET) {
      const excess = await db.company.findMany({
        where: { status: "LEAD" },
        orderBy: [{ recommendationScore: "asc" }, { recommendedAt: "asc" }],
        take: currentCount - QUEUE_TARGET,
        select: { id: true },
      });
      await db.company.deleteMany({ where: { id: { in: excess.map(l => l.id) } } });
      return NextResponse.json({ generated: 0, message: "Trimmed queue to 10" });
    }

    const toGenerate = Math.max(0, QUEUE_TARGET - currentCount);

    if (toGenerate === 0) {
      return NextResponse.json({ generated: 0, message: "Queue is already full" });
    }

    // --- Build context for Claude ---
    const [thesisCriteria, existingCompanies, recentFeedback] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" } }),
      db.companyFeedback.findMany({
        include: { company: { select: { name: true, sector: true, subSector: true, arrEstimate: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
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
      interested.length > 0
        ? `Investor LIKED: ${interested.map(f => `${f.company.name} (${f.company.sector}/${f.company.subSector})`).join(", ")}`
        : "",
      passed.length > 0
        ? `Investor PASSED: ${passed.map(f => `${f.company.name}${f.notes ? " — " + f.notes : ""}`).join("; ")}`
        : "",
    ].filter(Boolean).join("\n");

    const today = new Date().toISOString().slice(0, 10);

    const prompt = `You are helping a growth equity investor build a curated list of B2B SaaS investment leads. Today is ${today}.

INVESTOR THESIS:
${thesisSummary}

COMPANIES ALREADY IN PIPELINE — do not suggest these or close variants:
${existingNames}

${feedbackSection ? `INVESTOR FEEDBACK SIGNALS (use to calibrate recommendations):\n${feedbackSection}\n` : ""}
TASK: Generate exactly ${toGenerate} new company suggestions that genuinely fit this thesis. Prefer:
- Vertical software (industry-specific, not horizontal)
- Founder-majority owned, modest funding (<$8M raised)
- B2B enterprise / mid-market buyer
- Sectors with regulatory lock-in, workflow dependency, or high switching costs
- Founded 2018–2023, 15–250 employees

RESEARCH INSTRUCTIONS — this is critical:
Your training data is outdated. Funding rounds, employee counts, and ARR estimates change constantly. For EACH candidate company you consider, you MUST use the web_search tool to verify current facts before finalizing. Specifically:
1. Search "<company name> funding" or "<company name> Series B 2024 2025" to find the latest round (amount, date, lead investor, stage).
2. Search "<company name> employees LinkedIn" or "<company name> headcount" to triangulate current team size (LinkedIn, PitchBook public summaries, Growjo, RocketReach — use 2024/2025 figures only).
3. Search "<company name> ARR" or "<company name> revenue" to look for any disclosed or reported revenue figures (press releases, interviews, growth databases).
4. If the company has raised a meaningful recent round, use reported round size + stage-typical revenue multiples to estimate ARR (Series A ≈ $3–8M ARR, Series B ≈ $15–40M ARR, Series C ≈ $40–100M+ ARR). Cross-check against employee count (rough rule: $200–400K ARR per employee for healthy B2B SaaS).
5. If no recent round, triangulate from employees × $250K/employee and adjust for stage/sector.

Search efficiently — aim for ~2–3 searches per candidate, not more. Prefer specific queries with the company name and a year.

ACCURACY > COMPLETENESS: Better to return ${toGenerate} well-researched companies than ${toGenerate + 5} guesses. If a candidate turns out to be too large (>$100M ARR), too small (<$2M ARR), or already public/acquired, swap it out.

OUTPUT FORMAT:
After researching, return ONLY a valid JSON array — no explanation, no markdown fences, just the raw JSON. Each element:
{
  "name": "Company Name",
  "website": "https://example.com",
  "description": "2-3 sentences on what they do and what makes it differentiated",
  "sector": "B2B SaaS",
  "subSector": "e.g. Compliance Automation",
  "geography": "City, State",
  "arrEstimate": <estimated ARR in $M as a number>,
  "arrGrowth": <estimated YoY ARR growth % as a number>,
  "nrrEstimate": <estimated NRR % as a number>,
  "grossMargin": <estimated gross margin % as a number>,
  "employees": <verified headcount as a number>,
  "founded": <year as a number>,
  "stage": "Series A",
  "totalFundingM": <total funding raised in $M as a number>,
  "recommendationRationale": "2-3 sentences: which specific thesis criteria this meets and why it's a strong fit",
  "recommendationScore": <fit score 0-100 as a number>,
  "source": "Evidence summary — cite the latest funding source and employee source you used, e.g. 'Series B $42.5M (Apr 2025, PR Newswire); 200 employees (LinkedIn)'"
}`;

    // Use web search to verify real-time facts — critical for funding rounds & headcount
    // Cost: ~$10 / 1000 searches. Budget ~30 searches per 10-lead generation (~$0.30).
    // Note: web_search is a server-side tool; SDK v0.32 types don't recognize it yet,
    // so we cast the tools array to bypass the client-tool typing.
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 40 }] as any,
    });

    // With tool use, the final text block(s) contain the JSON. Concatenate all text blocks.
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    // Extract JSON array robustly — handle any surrounding text or code fences
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Claude response did not contain a JSON array:", rawText.slice(0, 500));
      return NextResponse.json({ error: "AI response was not valid JSON. Try again." }, { status: 500 });
    }

    let suggestions: Record<string, unknown>[];
    try {
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON parse error:", e);
      return NextResponse.json({ error: "AI returned malformed JSON. Try again." }, { status: 500 });
    }

    const now = new Date();
    const created = await Promise.all(
      suggestions.slice(0, toGenerate).map(s =>
        db.company.create({
          data: {
            name: String(s.name ?? "Unknown"),
            website: s.website ? String(s.website) : null,
            description: s.description ? String(s.description) : null,
            sector: s.sector ? String(s.sector) : null,
            subSector: s.subSector ? String(s.subSector) : null,
            geography: s.geography ? String(s.geography) : null,
            arrEstimate: s.arrEstimate != null ? Number(s.arrEstimate) : null,
            arrGrowth: s.arrGrowth != null ? Number(s.arrGrowth) : null,
            nrrEstimate: s.nrrEstimate != null ? Number(s.nrrEstimate) : null,
            grossMargin: s.grossMargin != null ? Number(s.grossMargin) : null,
            employees: s.employees != null ? Number(s.employees) : null,
            founded: s.founded != null ? Number(s.founded) : null,
            stage: s.stage ? String(s.stage) : null,
            totalFundingM: s.totalFundingM != null ? Number(s.totalFundingM) : null,
            status: "LEAD",
            priority: "MEDIUM",
            source: s.source ? String(s.source) : "AI recommendation",
            recommendationRationale: s.recommendationRationale ? String(s.recommendationRationale) : null,
            recommendationScore: s.recommendationScore != null ? Number(s.recommendationScore) : null,
            recommendedAt: now,
          },
        })
      )
    );

    return NextResponse.json({ generated: created.length });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
