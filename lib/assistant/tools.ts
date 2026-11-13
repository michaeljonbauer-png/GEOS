import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { COMPANY_STATUSES, COMPANY_TYPES, PRIORITIES, PIPELINE_STAGES, RELATIONSHIP_STRENGTHS, INTERACTION_TYPES } from "@/lib/utils";

// Read-only tools the GEOS assistant can call. Every result carries a `url`
// so the model can link records back into the app.

const STATUS_VALUES = COMPANY_STATUSES.map((s) => s.value);
const DAY = 24 * 60 * 60 * 1000;
const MAX_RESULT_CHARS = 14000;

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const clampLimit = (n: unknown, dflt: number, max: number) =>
  Math.min(max, Math.max(1, Math.round(Number(n) || dflt)));
const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" && v ? [v] : [];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const ci = (value: string) => ({ contains: value, mode: "insensitive" as const });

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_companies",
    description:
      "Search and filter companies in the user's GEOS database. Use for questions like 'which companies…', 'show me…', 'how many…'. Returns up to `limit` matches with status, priority, type, sector, location, ARR estimate, growth, last activity date, primary contact and a url. Leave filters out to match everything.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text matched against name, description, sector, sub-sector and location." },
        statuses: { type: "array", items: { type: "string", enum: STATUS_VALUES }, description: "Only these statuses." },
        onPipeline: { type: "boolean", description: "true = only pipeline stages (Qualifying, Memo Created, Offer Submitted, In Due Diligence)." },
        companyType: { type: "string", enum: COMPANY_TYPES.map((t) => t.value) },
        priorities: { type: "array", items: { type: "string", enum: PRIORITIES.map((p) => p.value) } },
        sector: { type: "string", description: "Matched against sector and sub-sector." },
        location: { type: "string", description: "Matched against the company's location, e.g. 'Austin' or 'TX'." },
        minArrM: { type: "number" },
        maxArrM: { type: "number" },
        foundedFrom: { type: "integer" },
        foundedTo: { type: "integer" },
        noActivityInDays: { type: "integer", description: "Only companies with no logged activity in the last N days (and not updated in that time)." },
        sortBy: { type: "string", enum: ["recent", "arr", "growth", "name", "priority", "score"], description: "Default: recent (last updated first)." },
        limit: { type: "integer", description: "Max results, default 25, max 50." },
      },
    },
  },
  {
    name: "get_company",
    description:
      "Full detail for one company: profile and metrics, thesis score and rationale, contacts (and people linked from other companies), recent activity, notes, underwrite memo, deal terms, diligence progress, and investment/KPIs if it's a PortCo. Pass the id from a search result, or a name.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, name: { type: "string" } },
    },
  },
  {
    name: "search_contacts",
    description:
      "Search people in the user's contacts. Filter by contact types (tags such as Operator, Advisor, LP, Prospective LP, Former Colleague), relationship strength, location, their company's type, or a company. Returns title, company, types, relationship, location, email, last interaction date and a url.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Matched against name, email, title, location and company name." },
        contactTypes: { type: "array", items: { type: "string" }, description: "Match contacts having ANY of these tags (case-insensitive)." },
        relationship: { type: "string", enum: RELATIONSHIP_STRENGTHS.map((r) => r.value) },
        location: { type: "string" },
        companyType: { type: "string", enum: COMPANY_TYPES.map((t) => t.value) },
        companyId: { type: "string", description: "Only people at, or linked to, this company." },
        limit: { type: "integer", description: "Default 25, max 50." },
      },
    },
  },
  {
    name: "list_activity",
    description:
      "Logged activity (emails, calls, meetings, LinkedIn messages, notes), newest first, and follow-ups. Filter by company, contact, type and date range, or use followUps to find overdue / upcoming / open follow-ups.",
    input_schema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        contactId: { type: "string" },
        type: { type: "string", enum: INTERACTION_TYPES.map((t) => t.value) },
        since: { type: "string", description: "YYYY-MM-DD inclusive." },
        until: { type: "string", description: "YYYY-MM-DD inclusive." },
        followUps: { type: "string", enum: ["overdue", "upcoming", "open"], description: "overdue = past due and not done; upcoming = due in the next 14 days; open = any not done." },
        limit: { type: "integer", description: "Default 30, max 60." },
      },
    },
  },
  {
    name: "pipeline_overview",
    description:
      "Snapshot of the whole funnel: company counts by status, every pipeline company by stage with priority and days since last activity, overdue follow-ups, and live deals.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "portfolio_overview",
    description: "Portfolio companies (Invested / PortCo) with investment terms, current marks, MOIC, and latest KPI snapshot.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lp_overview",
    description: "LP base (LPs, co-investors, advisors with commitments) and LP update memos with status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_thesis_and_preferences",
    description: "The user's investment thesis criteria (hard filters and weighted signals) and default sourcing preferences.",
    input_schema: { type: "object", properties: {} },
  },
];

const companyUrl = (id: string) => `/companies/${id}`;
const contactUrl = (id: string) => `/contacts/${id}`;
const statusLabel = (s: string) => COMPANY_STATUSES.find((x) => x.value === s)?.label ?? s;

async function searchCompanies(input: Record<string, unknown>) {
  const statuses = asArray(input.statuses);
  const and: Prisma.CompanyWhereInput[] = [];
  const query = str(input.query);
  if (query) and.push({ OR: [{ name: ci(query) }, { description: ci(query) }, { sector: ci(query) }, { subSector: ci(query) }, { geography: ci(query) }] });
  if (statuses.length) and.push({ status: { in: statuses } });
  else and.push({ status: { not: "LEAD" } });
  if (input.onPipeline === true) and.push({ status: { in: [...PIPELINE_STAGES] } });
  if (str(input.companyType)) and.push({ companyType: str(input.companyType) });
  const priorities = asArray(input.priorities);
  if (priorities.length) and.push({ priority: { in: priorities } });
  const sector = str(input.sector);
  if (sector) and.push({ OR: [{ sector: ci(sector) }, { subSector: ci(sector) }] });
  const location = str(input.location);
  if (location) and.push({ geography: ci(location) });
  if (num(input.minArrM) !== undefined) and.push({ arrEstimate: { gte: num(input.minArrM) } });
  if (num(input.maxArrM) !== undefined) and.push({ arrEstimate: { lte: num(input.maxArrM) } });
  if (num(input.foundedFrom) !== undefined) and.push({ founded: { gte: num(input.foundedFrom) } });
  if (num(input.foundedTo) !== undefined) and.push({ founded: { lte: num(input.foundedTo) } });
  const staleDays = num(input.noActivityInDays);
  if (staleDays !== undefined) {
    const cutoff = new Date(Date.now() - staleDays * DAY);
    and.push({ updatedAt: { lt: cutoff }, interactions: { none: { date: { gte: cutoff } } } });
  }

  const sortBy = str(input.sortBy) ?? "recent";
  const orderBy: Prisma.CompanyOrderByWithRelationInput =
    sortBy === "arr" ? { arrEstimate: { sort: "desc", nulls: "last" } }
      : sortBy === "growth" ? { arrGrowth: { sort: "desc", nulls: "last" } }
      : sortBy === "name" ? { name: "asc" }
      : sortBy === "score" ? { recommendationScore: { sort: "desc", nulls: "last" } }
      : { updatedAt: "desc" };

  const limit = clampLimit(input.limit, 25, 50);
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy,
      take: sortBy === "priority" ? 200 : limit,
      include: {
        contacts: { where: { isPrimary: true }, take: 1, select: { firstName: true, lastName: true, title: true } },
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
  ]);
  const rank = (p: string) => { const i = PRIORITIES.findIndex((x) => x.value === p); return i === -1 ? 99 : i; };
  const sorted = sortBy === "priority" ? [...rows].sort((a, b) => rank(a.priority) - rank(b.priority)).slice(0, limit) : rows;

  return {
    totalMatches: total,
    returned: sorted.length,
    companies: sorted.map((c) => ({
      id: c.id,
      name: c.name,
      url: companyUrl(c.id),
      status: statusLabel(c.status),
      priority: c.priority,
      companyType: c.companyType,
      sector: [c.sector, c.subSector].filter(Boolean).join(" / ") || null,
      location: c.geography,
      arrEstimateM: c.arrEstimate,
      arrGrowthPct: c.arrGrowth,
      employees: c.employees,
      founded: c.founded,
      stage: c.stage,
      totalFundingM: c.totalFundingM,
      thesisScore: c.recommendationScore,
      lastActivity: day(c.interactions[0]?.date),
      lastUpdated: day(c.updatedAt),
      primaryContact: c.contacts[0] ? `${c.contacts[0].firstName} ${c.contacts[0].lastName}${c.contacts[0].title ? `, ${c.contacts[0].title}` : ""}` : null,
    })),
  };
}

async function getCompany(input: Record<string, unknown>) {
  const id = str(input.id);
  const name = str(input.name);
  let companyId = id;
  if (!companyId && name) {
    const matches = await db.company.findMany({ where: { name: ci(name) }, select: { id: true, name: true }, take: 5 });
    const exact = matches.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (!exact && matches.length > 1) return { error: "Several companies match that name", candidates: matches.map((m) => ({ ...m, url: companyUrl(m.id) })) };
    companyId = (exact ?? matches[0])?.id;
  }
  if (!companyId) return { error: "No company found" };

  const c = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      contactAffiliations: { include: { contact: { include: { company: { select: { name: true } } } } } },
      interactions: { orderBy: { date: "desc" }, take: 15, include: { contact: { select: { firstName: true, lastName: true } } } },
      notes: { orderBy: { createdAt: "desc" }, take: 10 },
      underwrites: { orderBy: { createdAt: "desc" }, take: 2 },
      dealTerms: { orderBy: { order: "asc" } },
      diligenceTasks: { select: { status: true, title: true, workstream: true } },
      investment: true,
      kpiSnapshots: { orderBy: { period: "desc" }, take: 4 },
    },
  });
  if (!c) return { error: "No company found" };
  const clip = (s: string | null, n = 600) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

  return {
    id: c.id, name: c.name, url: companyUrl(c.id), website: c.website,
    status: statusLabel(c.status), priority: c.priority, companyType: c.companyType,
    description: c.description, sector: c.sector, subSector: c.subSector, location: c.geography,
    founded: c.founded, stage: c.stage, employees: c.employees, totalFundingM: c.totalFundingM,
    arrEstimateM: c.arrEstimate, arrGrowthPct: c.arrGrowth, nrrPct: c.nrrEstimate, grossMarginPct: c.grossMargin,
    source: c.source, thesisScore: c.recommendationScore, thesisRationale: c.recommendationRationale,
    addedOn: day(c.createdAt), lastUpdated: day(c.updatedAt),
    contacts: c.contacts.map((k) => ({
      id: k.id, url: contactUrl(k.id), name: `${k.firstName} ${k.lastName}`, title: k.title, email: k.email,
      primary: k.isPrimary, relationship: k.relationship, contactTypes: k.contactTypes, location: k.location,
    })),
    alsoConnected: c.contactAffiliations.map((a) => ({
      id: a.contact.id, url: contactUrl(a.contact.id), name: `${a.contact.firstName} ${a.contact.lastName}`,
      roleHere: a.role, currentCompany: a.contact.company.name,
    })),
    recentActivity: c.interactions.map((i) => ({
      date: day(i.date), type: i.type, direction: i.direction, subject: i.subject, notes: clip(i.content, 300),
      with: i.contact ? `${i.contact.firstName} ${i.contact.lastName}` : null,
      followUp: i.followUpDate ? { date: day(i.followUpDate), done: i.followUpDone } : null,
    })),
    notes: c.notes.map((n) => ({ date: day(n.createdAt), text: clip(n.content, 400) })),
    underwrite: c.underwrites[0]
      ? {
          id: c.underwrites[0].id, url: `/underwrite/${c.underwrites[0].id}`, status: c.underwrites[0].status,
          recommendation: c.underwrites[0].recommendation, merits: clip(c.underwrites[0].memoMerits),
          risks: clip(c.underwrites[0].memoRisks), narrative: clip(c.underwrites[0].memoNarrative),
        }
      : null,
    dealTerms: c.dealTerms.filter((t) => t.value?.trim()).map((t) => ({ term: t.name, value: t.value })),
    diligence: c.diligenceTasks.length
      ? {
          total: c.diligenceTasks.length,
          done: c.diligenceTasks.filter((t) => t.status === "DONE").length,
          blocked: c.diligenceTasks.filter((t) => t.status === "BLOCKED").map((t) => t.title),
        }
      : null,
    investment: c.investment
      ? {
          investedM: c.investment.investedAmount, ownershipPct: c.investment.ownershipPct, date: day(c.investment.investmentDate),
          round: c.investment.roundType, currentValuationM: c.investment.currentValuation, moic: c.investment.moic, boardSeat: c.investment.boardSeat,
        }
      : null,
    kpis: c.kpiSnapshots.map((k) => ({ period: k.period, arrM: k.arr, arrGrowthPct: k.arrGrowth, nrrPct: k.nrr, grossMarginPct: k.grossMargin, burnM: k.burn, runwayMonths: k.runway })),
  };
}

async function searchContacts(input: Record<string, unknown>) {
  const and: Prisma.ContactWhereInput[] = [];
  const query = str(input.query);
  if (query) and.push({ OR: [{ firstName: ci(query) }, { lastName: ci(query) }, { email: ci(query) }, { title: ci(query) }, { location: ci(query) }, { company: { name: ci(query) } }] });
  if (str(input.relationship)) and.push({ relationship: str(input.relationship) });
  const location = str(input.location);
  if (location) and.push({ location: ci(location) });
  if (str(input.companyType)) and.push({ company: { companyType: str(input.companyType) } });
  const companyId = str(input.companyId);
  if (companyId) and.push({ OR: [{ companyId }, { affiliations: { some: { companyId } } }] });

  const rows = await db.contact.findMany({
    where: { AND: and },
    include: {
      company: { select: { id: true, name: true, companyType: true } },
      affiliations: { include: { company: { select: { name: true } } } },
      interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
    orderBy: { lastName: "asc" },
    take: 500,
  });
  const wanted = asArray(input.contactTypes).map((t) => t.toLowerCase());
  const matched = wanted.length ? rows.filter((r) => r.contactTypes.some((t) => wanted.includes(t.toLowerCase()))) : rows;
  const limit = clampLimit(input.limit, 25, 50);

  return {
    totalMatches: matched.length,
    returned: Math.min(limit, matched.length),
    contacts: matched.slice(0, limit).map((k) => ({
      id: k.id, url: contactUrl(k.id), name: `${k.firstName} ${k.lastName}`, title: k.title,
      company: k.company.name, companyUrl: companyUrl(k.company.id), companyType: k.company.companyType,
      contactTypes: k.contactTypes, relationship: k.relationship, location: k.location, email: k.email,
      alsoConnectedTo: k.affiliations.map((a) => `${a.company.name}${a.role ? ` (${a.role})` : ""}`),
      lastInteraction: day(k.interactions[0]?.date),
    })),
  };
}

async function listActivity(input: Record<string, unknown>) {
  const where: Prisma.InteractionWhereInput = {};
  if (str(input.companyId)) where.companyId = str(input.companyId);
  if (str(input.contactId)) where.contactId = str(input.contactId);
  if (str(input.type)) where.type = str(input.type);
  const since = str(input.since), until = str(input.until);
  if (since || until) where.date = { ...(since && { gte: new Date(`${since}T00:00:00`) }), ...(until && { lte: new Date(`${until}T23:59:59`) }) };
  const now = new Date();
  const followUps = str(input.followUps);
  if (followUps === "overdue") Object.assign(where, { followUpDone: false, followUpDate: { lt: now } });
  if (followUps === "upcoming") Object.assign(where, { followUpDone: false, followUpDate: { gte: now, lte: new Date(now.getTime() + 14 * DAY) } });
  if (followUps === "open") Object.assign(where, { followUpDone: false, followUpDate: { not: null } });

  const limit = clampLimit(input.limit, 30, 60);
  const [total, rows] = await Promise.all([
    db.interaction.count({ where }),
    db.interaction.findMany({
      where,
      orderBy: followUps ? { followUpDate: "asc" } : { date: "desc" },
      take: limit,
      include: { company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);
  return {
    totalMatches: total,
    activity: rows.map((i) => ({
      date: day(i.date), type: i.type, direction: i.direction, subject: i.subject,
      notes: i.content && i.content.length > 240 ? `${i.content.slice(0, 240)}…` : i.content,
      company: i.company.name, companyUrl: companyUrl(i.company.id),
      contact: i.contact ? `${i.contact.firstName} ${i.contact.lastName}` : null,
      contactUrl: i.contact ? contactUrl(i.contact.id) : null,
      followUp: i.followUpDate ? { date: day(i.followUpDate), done: i.followUpDone } : null,
    })),
  };
}

async function pipelineOverview() {
  const now = Date.now();
  const [counts, pipeline, overdue, liveDeals] = await Promise.all([
    db.company.groupBy({ by: ["status"], _count: true, where: { companyType: "OPERATING_COMPANY" } }),
    db.company.findMany({
      where: { status: { in: [...PIPELINE_STAGES] } },
      select: { id: true, name: true, status: true, priority: true, arrEstimate: true, updatedAt: true, interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } } },
    }),
    db.interaction.count({ where: { followUpDone: false, followUpDate: { lt: new Date() } } }),
    db.company.count({ where: { status: { in: ["OFFER_SUBMITTED", "DUE_DILIGENCE"] } } }),
  ]);
  return {
    countsByStatus: Object.fromEntries(counts.map((c) => [statusLabel(c.status), c._count])),
    pipelineByStage: PIPELINE_STAGES.map((stage) => ({
      stage: statusLabel(stage),
      companies: pipeline.filter((c) => c.status === stage).map((c) => {
        const last = c.interactions[0]?.date ?? c.updatedAt;
        return { name: c.name, url: companyUrl(c.id), priority: c.priority, arrEstimateM: c.arrEstimate, daysSinceLastActivity: Math.floor((now - last.getTime()) / DAY) };
      }),
    })),
    overdueFollowUps: overdue,
    liveDeals,
  };
}

async function portfolioOverview() {
  const rows = await db.company.findMany({
    where: { status: "INVESTED" },
    include: { investment: true, kpiSnapshots: { orderBy: { period: "desc" }, take: 1 } },
  });
  return {
    portfolioCompanies: rows.map((c) => ({
      name: c.name, url: companyUrl(c.id), sector: c.sector,
      investedM: c.investment?.investedAmount ?? null, ownershipPct: c.investment?.ownershipPct ?? null,
      investmentDate: day(c.investment?.investmentDate), currentValuationM: c.investment?.currentValuation ?? null,
      moic: c.investment?.moic ?? null, latestKpi: c.kpiSnapshots[0]
        ? { period: c.kpiSnapshots[0].period, arrM: c.kpiSnapshots[0].arr, arrGrowthPct: c.kpiSnapshots[0].arrGrowth, nrrPct: c.kpiSnapshots[0].nrr, runwayMonths: c.kpiSnapshots[0].runway }
        : null,
    })),
  };
}

async function lpOverview() {
  const [contacts, updates] = await Promise.all([
    db.lPContact.findMany({ orderBy: { commitment: { sort: "desc", nulls: "last" } } }),
    db.lPUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, period: true, title: true, status: true, sentAt: true } }),
  ]);
  return {
    totalLpCommitmentsM: contacts.filter((c) => c.type === "LP").reduce((s, c) => s + (c.commitment ?? 0), 0),
    lpBase: contacts.map((c) => ({ name: c.name, firm: c.firm, type: c.type, commitmentM: c.commitment, email: c.email })),
    memos: updates.map((u) => ({ period: u.period, title: u.title, status: u.status, sentOn: day(u.sentAt), url: `/lp-reporting?update=${u.id}` })),
  };
}

async function thesisAndPreferences() {
  const [criteria, prefs] = await Promise.all([
    db.thesisCriterion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    db.sourcingPreferences.findUnique({ where: { id: "default" } }).catch(() => null),
  ]);
  return {
    thesisCriteria: criteria.map((t) => ({
      name: t.name, category: t.category, field: t.companyField ?? t.boolField, min: t.minValue, max: t.maxValue,
      unit: t.unit, mustBe: t.boolTarget, importance: t.importance, notes: t.notes ?? t.description,
    })),
    sourcingPreferences: prefs,
  };
}

const EXECUTORS: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  search_companies: searchCompanies,
  get_company: getCompany,
  search_contacts: searchContacts,
  list_activity: listActivity,
  pipeline_overview: pipelineOverview,
  portfolio_overview: portfolioOverview,
  lp_overview: lpOverview,
  get_thesis_and_preferences: thesisAndPreferences,
};

export async function runAssistantTool(name: string, input: unknown): Promise<{ content: string; isError: boolean }> {
  const exec = EXECUTORS[name];
  if (!exec) return { content: `Unknown tool: ${name}`, isError: true };
  try {
    const result = await exec(input && typeof input === "object" ? (input as Record<string, unknown>) : {});
    let text = JSON.stringify(result);
    if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [truncated — narrow the filters or lower the limit]`;
    return { content: text, isError: false };
  } catch (err) {
    console.error(`Assistant tool ${name} failed:`, err);
    return { content: `Tool failed: ${err instanceof Error ? err.message : "unknown error"}`, isError: true };
  }
}
