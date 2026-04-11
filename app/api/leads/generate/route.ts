import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const QUEUE_TARGET = 10;

const anthropic = new Anthropic();

export async function POST() {
  // How many leads do we need to reach the target?
  const currentCount = await db.company.count({ where: { status: "LEAD" } });
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

  const prompt = `You are helping a growth equity investor build a curated list of B2B SaaS investment leads.

INVESTOR THESIS:
${thesisSummary}

COMPANIES ALREADY IN PIPELINE — do not suggest these or close variants:
${existingNames}

${feedbackSection ? `INVESTOR FEEDBACK SIGNALS (use to calibrate recommendations):\n${feedbackSection}\n` : ""}
Generate exactly ${toGenerate} new company suggestions that genuinely fit this thesis. Prefer:
- Vertical software (industry-specific, not horizontal)
- Founder-majority owned, modest funding (<$8M raised)
- B2B enterprise / mid-market buyer
- Sectors with regulatory lock-in, workflow dependency, or high switching costs
- Founded 2018–2023, 15–250 employees

Return ONLY a valid JSON array — no explanation, no markdown fences, just the raw JSON. Each element:
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
  "employees": <estimated headcount as a number>,
  "founded": <year as a number>,
  "stage": "Series A",
  "recommendationRationale": "2-3 sentences: which specific thesis criteria this meets and why it's a strong fit",
  "recommendationScore": <fit score 0-100 as a number>,
  "source": "Where an investor would find this: e.g. Crunchbase, G2 category, Grata search, referral network"
}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // Extract JSON array robustly — handle any surrounding text or code fences
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Claude response did not contain a JSON array:", rawText.slice(0, 300));
    return NextResponse.json({ error: "Failed to parse lead suggestions from AI response" }, { status: 500 });
  }

  let suggestions: Record<string, unknown>[];
  try {
    suggestions = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON parse error:", e);
    return NextResponse.json({ error: "AI returned malformed JSON" }, { status: 500 });
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
}
