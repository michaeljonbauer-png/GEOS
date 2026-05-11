import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 9;
export const maxDuration = 120;

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

// Server-side ARR floor: ensures well-funded companies are never under-estimated.
function arrFloor(totalFundingM: number | null, employees: number | null): number | null {
  const a = totalFundingM != null ? totalFundingM / 5 : null;  // VCs invest at ~5× ARR
  const b = employees != null ? employees * 0.25 : null;        // $250K ARR/employee baseline
  const vals = [a, b].filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : null;
}

function handleApiError(err: unknown): NextResponse | null {
  if (isBillingError(err)) {
    return NextResponse.json(
      { error: "Anthropic credit balance too low. Add credits at console.anthropic.com → Plans & Billing." },
      { status: 402 }
    );
  }
  if (isRateLimitError(err)) {
    return NextResponse.json(
      { error: "Rate limit hit. Wait ~60 seconds and try again." },
      { status: 429 }
    );
  }
  return null;
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
    const [thesisCriteria, existingCompanies, recentFeedback, pursuedCompanies] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.companyFeedback.findMany({
        include: { company: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Pursued companies with scoring notes — these are your real signal of what you like
      db.company.findMany({
        where: { status: { in: ["IN_CONVERSATION", "DILIGENCE", "CLOSED_WON"] } },
        select: {
          name: true, sector: true, subSector: true, stage: true,
          arrEstimate: true, arrGrowth: true, employees: true,
          scoreDetails: { select: { score: true, notes: true, criterion: { select: { name: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const thesisSummary = thesisCriteria.map(t => {
      if (t.dataType === "RANGE" && t.companyField) {
        const parts = [
          t.minValue != null ? `min ${t.minValue}` : null,
          t.maxValue != null ? `max ${t.maxValue}` : null,
        ].filter(Boolean).join(", ");
        return `• ${t.name} [${t.category}]: ${t.companyField} — ${parts}${t.unit ? " " + t.unit : ""}`;
      }
      if (t.dataType === "BOOLEAN" && t.boolField) {
        return `• ${t.name} [${t.category}]: ${t.boolField} must be ${t.boolTarget}`;
      }
      return `• ${t.name} [${t.category}]: ${t.notes ?? t.description ?? "qualitative signal"}`;
    }).join("\n");

    // Build a richer picture of what the investor has pursued so the model can pattern-match
    const pursuedContext = pursuedCompanies.length > 0
      ? pursuedCompanies.map(c => {
          const notes = c.scoreDetails
            .filter(sd => sd.notes)
            .map(sd => `${sd.criterion.name}: ${sd.notes}`)
            .join("; ");
          return `• ${c.name} (${[c.sector, c.subSector, c.stage].filter(Boolean).join(", ")}${notes ? ` — notes: ${notes}` : ""})`;
        }).join("\n")
      : "";

    const existingNames = existingCompanies.map(c => c.name).join(", ") || "None yet";
    const interested = recentFeedback.filter(f => ["INTERESTED", "HIGH_PRIORITY"].includes(f.signal));
    const passed = recentFeedback.filter(f => f.signal === "PASS");
    const feedbackLine = [
      interested.length ? `Liked: ${interested.map(f => f.company.name).join(", ")}` : "",
      passed.length ? `Passed: ${passed.map(f => f.company.name).join(", ")}` : "",
    ].filter(Boolean).join(" | ");

    const today = new Date().toISOString().slice(0, 10);

    // ══ PHASE 1: Select + estimate (no web search — avoids rate limits) ═══════
    // Web search is intentionally omitted here. Each search adds ~2K tokens to the
    // growing context window; 9 searches would push a single generation over the
    // 30K input-tokens/minute tier-1 limit. Use the per-card "Refresh with live
    // web data" button to verify individual companies with targeted searches.
    type Company = {
      name: string; website?: string; sector?: string; subSector?: string;
      geography?: string; founded?: number; description?: string;
      stage?: string; totalFundingM?: number | null; employees?: number | null;
      arrEstimate?: number | null; arrGrowth?: number | null;
      nrrEstimate?: number | null; grossMargin?: number | null;
      acquired?: boolean; acquiredBy?: string | null;
      source?: string; recommendationRationale?: string;
      recommendationScore?: number | null;
      scoreBreakdown?: Array<{ criterion: string; met: boolean; score: number; note: string }>;
    };

    let companies: Company[] = [];

    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `Growth equity investor — B2B SaaS lead sourcing. Today: ${today}.

THESIS CRITERIA (score each company against all of these):
${thesisSummary}

SKIP (already in pipeline): ${existingNames}
${feedbackLine ? `\nINVESTOR FEEDBACK (use to calibrate): ${feedbackLine}` : ""}
${pursuedContext ? `\nCOMPANIES INVESTOR HAS PURSUED (pattern-match on these profiles when generating new leads):\n${pursuedContext}` : ""}

Generate exactly ${toGenerate} companies. Prefer vertical/industry software, B2B enterprise/mid-market, founded 2018–2023, 15–250 employees. EXCLUDE: acquired, PE-owned, public, roll-up subsidiaries.

For each company use your training knowledge to estimate metrics. Apply these ARR rules:
- ARR = MAX(employees×$250K, totalFunding÷5, stage floor)
- Stage floors: Seed $0.5M | Series A $3M | Series B $12M | Series C $25M | Series D+ $50M
- >$80M raised → ARR ≥ $25M | 100+ employees → ARR ≥ $10M

Return JSON array only:
[{
  "name": "",
  "website": "",
  "sector": "B2B SaaS",
  "subSector": "",
  "geography": "City, State",
  "founded": 0,
  "description": "2-3 sentences",
  "stage": "Series A",
  "totalFundingM": 0,
  "employees": 0,
  "arrEstimate": 0,
  "arrGrowth": 0,
  "nrrEstimate": 0,
  "grossMargin": 0,
  "acquired": false,
  "acquiredBy": null,
  "recommendationScore": 0,
  "recommendationRationale": "2-3 sentences overall fit",
  "scoreBreakdown": [
    { "criterion": "exact criterion name", "met": true, "score": 0, "note": "1 sentence" }
  ],
  "source": "Training knowledge — verify via Refresh button"
}]

SCORING: score each criterion 0-100. met=true if clearly satisfied. recommendationScore = honest weighted avg (hard filter failures pull score below 50).`,
        }],
      });

      if (msg.stop_reason === "max_tokens") {
        console.error("Lead generation response was truncated (max_tokens hit)");
        return NextResponse.json(
          { error: "Response was too long and got cut off. Try again — it should work on the next attempt." },
          { status: 500 }
        );
      }

      const text = msg.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("\n");

      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          companies = JSON.parse(match[0]);
        } catch {
          console.error("JSON parse failed. Raw text:", text.slice(0, 500));
          return NextResponse.json(
            { error: "Could not parse company list. Try again." },
            { status: 500 }
          );
        }
      }
    } catch (err) {
      const errResponse = handleApiError(err);
      if (errResponse) return errResponse;
      throw err;
    }

    if (!companies.length) {
      return NextResponse.json({ error: "No companies returned. Try again." }, { status: 500 });
    }

    // Filter out acquired / PE-owned / public companies
    const acquiredNames: string[] = [];
    const viable = companies.filter(c => {
      if (c.acquired === true) {
        acquiredNames.push(`${c.name}${c.acquiredBy ? ` (→ ${c.acquiredBy})` : ""}`);
        return false;
      }
      return true;
    });
    if (acquiredNames.length) console.log(`Filtered acquired: ${acquiredNames.join(", ")}`);

    const now = new Date();
    const created = await Promise.all(
      viable.slice(0, toGenerate).map(c => {
        // Apply ARR floor server-side as a safety net regardless of what Claude returned
        let arrEstimate = c.arrEstimate ?? null;
        const floor = arrFloor(c.totalFundingM ?? null, c.employees ?? null);
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
            stage: c.stage ?? null,
            totalFundingM: c.totalFundingM ?? null,
            employees: c.employees ?? null,
            arrEstimate,
            arrGrowth: c.arrGrowth ?? null,
            nrrEstimate: c.nrrEstimate ?? null,
            grossMargin: c.grossMargin ?? null,
            status: "LEAD",
            priority: "MEDIUM",
            source: c.source ?? "AI recommendation — verify via Refresh",
            recommendationRationale: c.recommendationRationale ?? null,
            recommendationScore: c.recommendationScore ?? null,
            scoreBreakdown: Array.isArray(c.scoreBreakdown) && c.scoreBreakdown.length > 0
              ? JSON.stringify(c.scoreBreakdown)
              : null,
            recommendedAt: now,
          },
        });
      })
    );

    return NextResponse.json({ generated: created.length, filtered: acquiredNames });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
