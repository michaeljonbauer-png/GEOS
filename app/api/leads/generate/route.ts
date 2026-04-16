import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 9;

// Two-phase generation: candidate selection (~5s) + per-company funding research (~60-90s)
export const maxDuration = 300;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isRateLimitError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  return status === 429 || /rate.?limit/i.test(msg);
}

function isBillingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  return status === 402 || /credit balance/i.test(msg);
}

// Use total funding + employee count to compute a floor ARR estimate in $M.
// This prevents the common failure of under-estimating well-funded companies.
function arrFloor(totalFundingM: number | null, employees: number | null): number | null {
  const fromFunding = totalFundingM != null ? totalFundingM / 5 : null;  // ~5x ARR multiple
  const fromEmployees = employees != null ? (employees * 0.25) : null;   // $250K ARR/employee
  const candidates = [fromFunding, fromEmployees].filter((v): v is number => v != null);
  return candidates.length > 0 ? Math.max(...candidates) : null;
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

    // ── Phase 1: Build context ───────────────────────────────────────────────
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
      interested.length > 0 ? `Investor LIKED: ${interested.map(f => f.company.name).join(", ")}` : "",
      passed.length > 0 ? `Investor PASSED: ${passed.map(f => `${f.company.name}${f.notes ? " — " + f.notes : ""}`).join("; ")}` : "",
    ].filter(Boolean).join("\n");

    const today = new Date().toISOString().slice(0, 10);

    // ── Phase 2: Select candidates (no search, fast & cheap) ─────────────────
    const selectionPrompt = `You are helping a growth equity investor identify B2B SaaS investment leads. Today is ${today}.

INVESTOR THESIS:
${thesisSummary}

ALREADY IN PIPELINE — skip these and close variants:
${existingNames}

${feedbackSection ? `INVESTOR FEEDBACK:\n${feedbackSection}\n` : ""}
List exactly ${toGenerate} candidate companies that fit this thesis. Prefer:
- Vertical/industry-specific software, NOT horizontal tools
- B2B enterprise or mid-market buyer
- Founded 2018–2023, 15–250 employees, modest funding
- Regulatory lock-in, workflow dependency, or high switching costs

HARD EXCLUSIONS — do NOT suggest any company that is:
- Acquired, merged, or a subsidiary of another company
- Backed by private equity (PE-owned or PE-controlled)
- Publicly traded (NYSE, NASDAQ, etc.)
- Part of a portfolio company roll-up

Return ONLY a JSON array. Each element:
{
  "name": "Company Name",
  "website": "https://...",
  "sector": "B2B SaaS",
  "subSector": "e.g. Construction Tech",
  "geography": "City, State",
  "founded": <year>,
  "description": "2-3 sentences — what they do and why differentiated"
}`;

    const selectionMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: selectionPrompt }],
    });

    const selectionText = selectionMsg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n");

    const selectionMatch = selectionText.match(/\[[\s\S]*\]/);
    if (!selectionMatch) {
      return NextResponse.json({ error: "Candidate selection did not return JSON. Try again." }, { status: 500 });
    }

    const candidates: Array<{ name: string; website?: string; sector?: string; subSector?: string; geography?: string; founded?: number; description?: string }> = JSON.parse(selectionMatch[0]);

    // ── Phase 3: Enrich each candidate with one targeted funding search ───────
    const enrichmentPrompt = `You are a research analyst. Today is ${today}.

For each company below, search for its current funding and headcount, then return corrected estimates.

COMPANIES TO RESEARCH:
${candidates.map((c, i) => `${i + 1}. ${c.name} (${c.website ?? "unknown website"})`).join("\n")}

For each company, do ONE search: "<company name> acquired funding employees"
This single query will surface acquisition news, total funding raised, and headcount simultaneously.

Then return a JSON array with one object per company:
{
  "name": "Company Name",
  "acquired": <true if acquired, PE-owned, gone public, or part of a roll-up — false otherwise>,
  "acquiredBy": "Acquirer name if acquired, else null",
  "stage": "Series B",
  "totalFundingM": <total $M raised — sum ALL rounds>,
  "employees": <current headcount>,
  "arrEstimate": <ARR in $M — USE RULES BELOW>,
  "arrGrowth": <estimated YoY % growth>,
  "nrrEstimate": <estimated NRR %>,
  "grossMargin": <estimated gross margin %>,
  "recommendationScore": <0-100 fit score>,
  "recommendationRationale": "2-3 sentences on thesis fit",
  "source": "What you found: e.g. 'Series C $39M (2023 PR Newswire); 152 employees (LinkedIn 2025)'"
}

ACQUISITION CHECK — this is critical. If the search shows ANY of these, set acquired: true:
- "acquired by", "acquisition", "merger", "joins [company]"
- PE firm ownership (Vista Equity, Thoma Bravo, Francisco Partners, etc.)
- IPO or SPAC listing
- "subsidiary of", "now part of", "portfolio company of"

ARR ESTIMATION RULES — follow these strictly:
1. Start with: employees × $250K = ARR baseline
2. Also compute: totalFundingM ÷ 5 = ARR lower bound (VCs invest at ~5x ARR)
3. ARR estimate = MAX of (baseline, lower bound, stage floor below)
4. Stage floors (MINIMUM values — never go below these):
   - Seed / Pre-Seed: $0.5M ARR
   - Series A: $3M ARR
   - Series B: $12M ARR
   - Series C: $25M ARR
   - Series D+: $50M ARR
5. If total funding >$50M → ARR is AT LEAST $15M
6. If total funding >$80M → ARR is AT LEAST $25M
7. If 100+ employees → ARR is AT LEAST $10M

Example: 152 employees, $79M total raised, Series C
  → baseline: 152 × $250K = $38M
  → lower bound: $79M ÷ 5 = $15.8M
  → stage floor: $25M
  → ARR estimate = $38M ✓ (NOT $3.8M)

Return ONLY the JSON array — no markdown, no explanation.`;

    let enriched: Array<Record<string, unknown>> = [];
    let searchSucceeded = false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enrichMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        messages: [{ role: "user", content: enrichmentPrompt }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: toGenerate + 3 }] as any,
      } as any);

      const enrichText = enrichMsg.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("\n");

      const enrichMatch = enrichText.match(/\[[\s\S]*\]/);
      if (enrichMatch) {
        enriched = JSON.parse(enrichMatch[0]);
        searchSucceeded = true;
      }
    } catch (enrichErr) {
      if (isBillingError(enrichErr)) {
        return NextResponse.json(
          { error: "Anthropic credit balance is too low. Go to console.anthropic.com → Plans & Billing to add credits." },
          { status: 402 }
        );
      }
      if (isRateLimitError(enrichErr)) {
        console.warn("Rate limited on enrichment — using candidate estimates only");
        // Fall through: enriched stays empty, we'll use candidates with floor estimates
      } else {
        console.warn("Enrichment failed, using candidate estimates:", enrichErr instanceof Error ? enrichErr.message : String(enrichErr));
      }
    }

    // Build a lookup: company name → enrichment data
    const enrichMap = new Map(enriched.map(e => [String(e.name ?? "").toLowerCase(), e]));

    // Filter out companies the enrichment flagged as acquired/PE-owned/public
    const acquiredNames: string[] = [];
    const viableCandidates = candidates.slice(0, toGenerate).filter(c => {
      const e = enrichMap.get(c.name.toLowerCase());
      if (e?.acquired === true) {
        acquiredNames.push(`${c.name}${e.acquiredBy ? ` (acquired by ${e.acquiredBy})` : ""}`);
        console.log(`Filtered out acquired company: ${c.name}`);
        return false;
      }
      return true;
    });

    if (acquiredNames.length > 0) {
      console.log(`Dropped ${acquiredNames.length} acquired companies: ${acquiredNames.join(", ")}`);
    }

    const now = new Date();
    const created = await Promise.all(
      viableCandidates.map(c => {
        const e = enrichMap.get(c.name.toLowerCase()) ?? {};
        const totalFundingM = e.totalFundingM != null ? Number(e.totalFundingM) : null;
        const employees = e.employees != null ? Number(e.employees) : null;

        // Apply ARR floor rules server-side as a safety net
        let arrEstimate = e.arrEstimate != null ? Number(e.arrEstimate) : null;
        const floor = arrFloor(totalFundingM, employees);
        if (floor != null && (arrEstimate == null || arrEstimate < floor)) {
          arrEstimate = Math.round(floor * 10) / 10;
        }

        return db.company.create({
          data: {
            name: c.name,
            website: c.website ?? null,
            description: c.description ?? null,
            sector: c.sector ?? null,
            subSector: c.subSector ?? null,
            geography: c.geography ?? null,
            founded: c.founded ?? null,
            stage: e.stage ? String(e.stage) : null,
            totalFundingM,
            employees,
            arrEstimate,
            arrGrowth: e.arrGrowth != null ? Number(e.arrGrowth) : null,
            nrrEstimate: e.nrrEstimate != null ? Number(e.nrrEstimate) : null,
            grossMargin: e.grossMargin != null ? Number(e.grossMargin) : null,
            status: "LEAD",
            priority: "MEDIUM",
            source: e.source
              ? String(e.source)
              : searchSucceeded ? "AI recommendation (web-verified)" : "AI recommendation",
            recommendationRationale: e.recommendationRationale ? String(e.recommendationRationale) : null,
            recommendationScore: e.recommendationScore != null ? Number(e.recommendationScore) : null,
            recommendedAt: now,
          },
        });
      })
    );

    return NextResponse.json({
      generated: created.length,
      webSearchUsed: searchSucceeded,
      filtered: acquiredNames,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
