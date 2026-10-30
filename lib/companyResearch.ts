// Client-side helpers shared by every "add a company" flow (Hunt, Scout,
// Companies → Add Company) so they research and save companies identically.

export interface ResearchedCompany {
  name: string;
  website?: string | null;
  description?: string | null;
  sector?: string | null;
  subSector?: string | null;
  geography?: string | null;
  founded?: number | null;
  stage?: string | null;
  totalFundingM?: number | null;
  employees?: number | null;
  arrEstimate?: number | null;
  arrGrowth?: number | null;
  nrrEstimate?: number | null;
  grossMargin?: number | null;
  acquired?: boolean;
  acquiredBy?: string | null;
  fitScore?: number | null;
  fitRationale?: string | null;
  huntScore?: number | null;
  huntRationale?: string | null;
  founderName?: string | null;
  founderTitle?: string | null;
  founderLinkedIn?: string | null;
  founderEmail?: string | null;
  source?: string | null;
}

// Web-verified lookup of a single company (name or URL), scored against the thesis.
export async function researchCompany(query: string): Promise<ResearchedCompany> {
  const res = await fetch("/api/scout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: query.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.result) throw new Error(data.error ?? "Could not research this company");
  return data.result as ResearchedCompany;
}

// Saves a researched company plus its founder as the primary contact.
// `extra` carries form fields (status, priority, companyType, user edits) and
// wins over researched values.
export async function saveResearchedCompany(
  result: ResearchedCompany,
  extra: Record<string, unknown> & { status: string; source?: string | null },
): Promise<{ id: string }> {
  const res = await fetch("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: result.name,
      website: result.website,
      description: result.description,
      sector: result.sector,
      subSector: result.subSector,
      geography: result.geography,
      founded: result.founded,
      stage: result.stage,
      totalFundingM: result.totalFundingM,
      employees: result.employees,
      arrEstimate: result.arrEstimate,
      arrGrowth: result.arrGrowth,
      nrrEstimate: result.nrrEstimate,
      grossMargin: result.grossMargin,
      priority: "UNKNOWN",
      recommendationScore: result.fitScore ?? result.huntScore ?? null,
      recommendationRationale: result.fitRationale ?? result.huntRationale ?? null,
      ...extra,
      source: extra.source ?? result.source ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to save company");

  if (result.founderName?.trim()) {
    const parts = result.founderName.trim().split(/\s+/);
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || "-",
        title: result.founderTitle ?? "Founder",
        linkedinUrl: result.founderLinkedIn ?? null,
        email: result.founderEmail ?? null,
        isPrimary: true,
        companyId: data.id,
      }),
    }).catch(() => { /* company is saved; contact is best-effort */ });
  }
  return { id: data.id };
}
