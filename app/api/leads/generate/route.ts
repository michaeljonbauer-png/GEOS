import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { parseJsonObjects } from "@/lib/json";

export const dynamic = "force-dynamic";

const MAX_QUEUE = 9;
const DEFAULT_QUEUE = 6;
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

const BATCH_SIZE = 3;

// ─── Route ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { target?: number };
  const target = Math.min(MAX_QUEUE, Math.max(1, Math.round(Number(body.target) || DEFAULT_QUEUE)));

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it in Railway → your service → Variables." },
      { status: 500 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const currentCount = await db.company.count({ where: { status: "LEAD" } });

    if (currentCount > MAX_QUEUE) {
      const excess = await db.company.findMany({
        where: { status: "LEAD" },
        orderBy: [{ recommendationScore: "asc" }, { recommendedAt: "asc" }],
        take: currentCount - MAX_QUEUE,
        select: { id: true },
      });
      await db.company.deleteMany({ where: { id: { in: excess.map(l => l.id) } } });
      return NextResponse.json({ generated: 0, message: `Trimmed queue to ${MAX_QUEUE}` });
    }

    const toGenerate = Math.max(0, target - currentCount);
    if (toGenerate === 0) {
      return NextResponse.json({
        generated: 0,
        message: `You already have ${currentCount} lead${currentCount === 1 ? "" : "s"} queued — pursue or pass on some, or pick a bigger queue size.`,
      });
    }

    // ── Context ──────────────────────────────────────────────────────────────
    const [thesisCriteria, existingCompanies, recentFeedback, pursuedCompanies, sourcingPrefs] = await Promise.all([
      db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      db.company.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.companyFeedback.findMany({
        include: { company: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Pursued companies with scoring notes — these are your real signal of what you like
      db.company.findMany({
        where: { status: { in: ["IN_CONVERSATION", "QUALIFYING", "MEMO_CREATED", "OFFER_SUBMITTED", "DUE_DILIGENCE", "INVESTED"] } },
        select: {
          name: true, sector: true, subSector: true, stage: true,
          arrEstimate: true, arrGrowth: true, employees: true,
          scoreDetails: { select: { score: true, notes: true, criterion: { select: { name: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.sourcingPreferences.findUnique({ where: { id: "default" } }).catch(() => null),
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

    // Build preferences summary for the Claude prompt
    let prefsSummary = "";
    let prefEndMarkets: string[] = [];
    if (sourcingPrefs) {
      const parts: string[] = [];
      if (sourcingPrefs.businessModel && sourcingPrefs.businessModel !== "Both") parts.push(`• Business model: ${sourcingPrefs.businessModel} only`);
      const endMarkets = (() => { try { return JSON.parse(sourcingPrefs.endMarkets); } catch { return []; } })();
      if (endMarkets.length) parts.push(`• Target end markets / industries: ${endMarkets.join(", ")}`);
      prefEndMarkets = Array.isArray(endMarkets) ? endMarkets.filter((m: unknown): m is string => typeof m === "string") : [];
      if (sourcingPrefs.softwareType) parts.push(`• Software type: ${sourcingPrefs.softwareType}`);
      const stages = (() => { try { return JSON.parse(sourcingPrefs.targetStages); } catch { return []; } })();
      if (stages.length) parts.push(`• Target stages: ${stages.join(", ")}`);
      if (sourcingPrefs.minArrM != null || sourcingPrefs.maxArrM != null) {
        const lo = sourcingPrefs.minArrM != null ? `$${sourcingPrefs.minArrM}M` : null;
        const hi = sourcingPrefs.maxArrM != null ? `$${sourcingPrefs.maxArrM}M` : null;
        parts.push(`• ARR range: ${[lo, hi].filter(Boolean).join(" – ")}`);
      }
      if (sourcingPrefs.minEmployees != null || sourcingPrefs.maxEmployees != null) {
        parts.push(`• Employees: ${sourcingPrefs.minEmployees ?? "any"}–${sourcingPrefs.maxEmployees ?? "any"}`);
      }
      if (sourcingPrefs.maxFundingM != null) parts.push(`• Max total funding raised: $${sourcingPrefs.maxFundingM}M`);
      if (sourcingPrefs.minFoundedYear != null || sourcingPrefs.maxFoundedYear != null) {
        parts.push(`• Founded: ${sourcingPrefs.minFoundedYear ?? "any"} – ${sourcingPrefs.maxFoundedYear ?? "present"}`);
      }
      if (sourcingPrefs.additionalNotes) parts.push(`• Additional: ${sourcingPrefs.additionalNotes}`);
      prefsSummary = parts.join("\n");
    }

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

    // Split into small parallel batches: one call for all leads (each with a
    // per-criterion score breakdown) overran the output limit and took ~2 min.
    const batchSizes: number[] = [];
    for (let left = toGenerate; left > 0; left -= BATCH_SIZE) batchSizes.push(Math.min(BATCH_SIZE, left));
    const LETTER_RANGES = ["A–H", "I–Q", "R–Z"];
    const focusFor = (i: number) => {
      if (prefEndMarkets.length >= batchSizes.length) {
        const mine = prefEndMarkets.filter((_, idx) => idx % batchSizes.length === i);
        return `Focus this batch on these end markets: ${mine.join(", ")}.`;
      }
      return batchSizes.length > 1
        ? `To avoid overlap with parallel batches, pick companies whose names start with ${LETTER_RANGES[i % LETTER_RANGES.length]}.`
        : "";
    };

    const promptFor = (count: number, focus: string) => `Growth equity investor — B2B SaaS lead sourcing. Today: ${today}.

THESIS CRITERIA (score each company against all of these):
${thesisSummary}

SKIP (already in pipeline): ${existingNames}
${feedbackLine ? `\nINVESTOR FEEDBACK (use to calibrate): ${feedbackLine}` : ""}
${pursuedContext ? `\nCOMPANIES INVESTOR HAS PURSUED (pattern-match on these profiles when generating new leads):\n${pursuedContext}` : ""}

${prefsSummary ? `INVESTOR SOURCING PREFERENCES (prioritize companies matching all of these):\n${prefsSummary}\n\n` : "Prefer vertical/industry software, B2B enterprise/mid-market, founded 2018–2023, 15–250 employees.\n\n"}Generate exactly ${count} companies. ${focus} EXCLUDE: acquired, PE-owned, public, roll-up subsidiaries.

For each company use your training knowledge to estimate metrics. Apply these ARR rules:
- ARR = MAX(employees×$250K, totalFunding÷5, stage floor)
- Stage floors: Seed $0.5M | Series A $3M | Series B $12M | Series C $25M | Series D+ $50M
- >$80M raised → ARR ≥ $25M | 100+ employees → ARR ≥ $10M

Be concise: description 2 sentences, rationale 1–2 sentences, each breakdown note under 12 words.

Return JSON array only:
[{
  "name": "",
  "website": "",
  "sector": "B2B SaaS",
  "subSector": "",
  "geography": "City, State",
  "founded": 0,
  "description": "",
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
  "recommendationRationale": "",
  "scoreBreakdown": [
    { "criterion": "exact criterion name", "met": true, "score": 0, "note": "" }
  ],
  "source": "Training knowledge — verify via Refresh button"
}]

SCORING: score each criterion 0-100. met=true if clearly satisfied. recommendationScore = honest weighted avg (hard filter failures pull score below 50).`;

    const runBatch = async (count: number, i: number): Promise<Company[]> => {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        messages: [{ role: "user", content: promptFor(count, focusFor(i)) }],
      });
      const text = msg.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("\n");
      if (msg.stop_reason === "max_tokens") console.warn(`Lead batch ${i + 1} hit max_tokens; keeping complete entries`);
      return parseJsonObjects<Company>(text);
    };

    const settled = await Promise.allSettled(batchSizes.map((n, i) => runBatch(n, i)));
    const failures = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length === settled.length) {
      const errResponse = handleApiError(failures[0].reason);
      if (errResponse) return errResponse;
      throw failures[0].reason;
    }
    failures.forEach(f => console.error("Lead batch failed:", f.reason instanceof Error ? f.reason.message : f.reason));

    // De-duplicate across batches and against everything already in GEOS.
    const candidates = settled.flatMap(r => (r.status === "fulfilled" ? r.value : [])).filter(c => c?.name?.trim());
    const alreadyTracked = await db.company.findMany({
      where: { name: { in: candidates.map(c => c.name.trim()), mode: "insensitive" } },
      select: { name: true },
    });
    const seen = new Set(alreadyTracked.map(c => c.name.toLowerCase()));
    const companies: Company[] = [];
    for (const c of candidates) {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      companies.push(c);
    }

    if (!companies.length) {
      return NextResponse.json({ error: "No new companies returned. Try again." }, { status: 500 });
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
            priority: "UNKNOWN",
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
