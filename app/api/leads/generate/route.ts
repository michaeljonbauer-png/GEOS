import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 9;

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
      return NextResponse.json({ generated: 0, message: "Trimmed queue to 9" });
    }

    const toGenerate = Math.max(0, QUEUE_TARGET - currentCount);

    if (toGenerate === 0) {
      return NextResponse.json({ generated: 0, message: "Queue is already full" });
    }

    // --- Build context for Claude ---
    const [thesisCriteria, existingCompanies, recentFeedback] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 30 }),
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

RESEARCH INSTRUCTIONS:
Your training data is outdated — funding rounds and headcounts change constantly. You have a budget of 8 web searches total. Use them wisely across the ${toGenerate} companies:
- Prioritise searching for the 3–4 most promising candidates you're least certain about.
- One focused query per company: "<company name> funding 2024 2025" covers latest round, stage, and employee hints simultaneously.
- Use reported round + stage multiples to estimate ARR: Series A ≈ $3–8M, Series B ≈ $15–40M, Series C ≈ $40–100M+. Cross-check: $200–400K ARR per employee is a healthy B2B SaaS baseline.
- Skip searching for companies whose facts you're already confident about from training data.

ACCURACY > COMPLETENESS: If a candidate turns out to be too large (>$100M ARR), too small (<$2M ARR), or public/acquired, substitute a better one.

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

    // Helper: call Claude and extract the JSON array from the response
    const callClaude = async (useWebSearch: boolean) => {
      // Note: web_search is a server-side tool; SDK v0.32 types don't recognise it,
      // so we cast to bypass type checking.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        model: "claude-sonnet-4-6",
        max_tokens: 5000,
        messages: [{ role: "user", content: useWebSearch ? prompt : promptNoSearch }],
      };
      if (useWebSearch) {
        // max_uses kept low (8) so cumulative input tokens stay under the 30K/min tier-1 limit
        body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
      }
      const msg = await anthropic.messages.create(body);
      return msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
    };

    // Fallback prompt without search instructions (used when web search is unavailable)
    const promptNoSearch = prompt.replace(
      /RESEARCH INSTRUCTIONS[\s\S]*?ACCURACY > COMPLETENESS[^\n]*/,
      `Use your best knowledge to estimate ARR, funding, and headcount.
Stage multiples: Seed ≈ $0.5–2M, Series A ≈ $3–8M, Series B ≈ $15–40M, Series C ≈ $40–100M+.
Employee baseline: $200–400K ARR/employee for healthy B2B SaaS.

ACCURACY > COMPLETENESS: If unsure whether a company fits, pick a different one.`
    );

    let rawText: string;
    let usedWebSearch = true;

    try {
      rawText = await callClaude(true);
    } catch (searchErr) {
      const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
      const isBilling = /credit balance/i.test(msg);
      // "rate limit" (space) or "rate_limit" (underscore) — Anthropic uses both in different contexts
      const isRateLimit = /rate.?limit|429/i.test(msg);
      const isRecoverable = isBilling || isRateLimit || /529|overloaded/i.test(msg);

      if (!isRecoverable) throw searchErr;

      if (isBilling) {
        return NextResponse.json(
          { error: "Anthropic credit balance is too low. Go to console.anthropic.com → Plans & Billing to add credits." },
          { status: 402 }
        );
      }

      if (isRateLimit) {
        // Fallback without web search uses far fewer tokens — try immediately
        console.warn("Rate limited on web-search call, falling back to no-search:", msg.slice(0, 120));
        usedWebSearch = false;
        try {
          rawText = await callClaude(false);
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          return NextResponse.json(
            { error: "Rate limit hit. Wait 60 seconds and try again, or refresh the page." },
            { status: 429 }
          );
        }
      } else {
        console.warn("Web search unavailable, falling back to no-search generation:", msg.slice(0, 120));
        usedWebSearch = false;
        rawText = await callClaude(false);
      }
    }

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
            source: s.source
              ? String(s.source)
              : usedWebSearch ? "AI recommendation (web-verified)" : "AI recommendation",
            recommendationRationale: s.recommendationRationale ? String(s.recommendationRationale) : null,
            recommendationScore: s.recommendationScore != null ? Number(s.recommendationScore) : null,
            recommendedAt: now,
          },
        })
      )
    );

    return NextResponse.json({
      generated: created.length,
      webSearchUsed: usedWebSearch,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
