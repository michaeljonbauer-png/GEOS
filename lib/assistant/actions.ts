import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normalizeUrl } from "@/lib/urls";
import {
  cleanTags, getCompanyTypeConfig, getStatusConfig, isOperatingCompany, DEFAULT_CONTACT_TYPES,
  COMPANY_STATUSES, COMPANY_TYPES, PRIORITIES, RELATIONSHIP_STRENGTHS, INTERACTION_TYPES,
} from "@/lib/utils";
import { POST as createCompanyRoute } from "@/app/api/companies/route";
import { PATCH as updateCompanyRoute } from "@/app/api/companies/[id]/route";
import { POST as createContactRoute } from "@/app/api/contacts/route";
import { PATCH as updateContactRoute } from "@/app/api/contacts/[id]/route";
import { POST as createInteractionRoute } from "@/app/api/interactions/route";
import { POST as createNoteRoute } from "@/app/api/notes/route";
import { POST as scoutRoute } from "@/app/api/scout/route";

// Write tools never change data directly: the model's call becomes a
// proposal the user confirms in the chat, and only then executeAction()
// runs it through the same API handlers the rest of the app uses.

export type ActionType = "add_company" | "add_contact" | "update_company" | "update_contact" | "log_activity" | "add_note";

export interface Proposal {
  id: string;
  type: ActionType;
  title: string;
  details: { label: string; value: string }[];
  warnings: string[];
  payload: Record<string, unknown>;
}

const STATUS_VALUES = COMPANY_STATUSES.map((s) => s.value as string);
const TYPE_VALUES = COMPANY_TYPES.map((t) => t.value);
const PRIORITY_VALUES = PRIORITIES.map((p) => p.value);
const RELATIONSHIP_VALUES = RELATIONSHIP_STRENGTHS.map((r) => r.value);
const INTERACTION_VALUES = INTERACTION_TYPES.map((t) => t.value as string);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const ci = (value: string) => ({ equals: value, mode: "insensitive" as const });
const isDate = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "add_company",
    description:
      "Propose adding a company to GEOS (the user confirms before it's saved). For operating companies, research is on by default: on confirm GEOS runs the same web research as Hunt to fill in the profile, thesis score and founder. New companies start as Identified unless the user says otherwise.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        website: { type: "string" },
        companyType: { type: "string", enum: TYPE_VALUES, description: "Default OPERATING_COMPANY." },
        status: { type: "string", enum: STATUS_VALUES, description: "Default IDENTIFIED." },
        priority: { type: "string", enum: PRIORITY_VALUES },
        location: { type: "string" },
        sector: { type: "string" },
        description: { type: "string" },
        note: { type: "string", description: "Optional note to attach, e.g. how the user heard about it." },
        research: { type: "boolean", description: "Run web research on confirm. Default true for operating companies." },
      },
      required: ["name"],
    },
  },
  {
    name: "add_contact",
    description:
      "Propose adding a person to GEOS contacts (the user confirms before it's saved). Every contact belongs to a company: pass companyId from a search, or companyName (an existing company is matched by name; otherwise a new company is created with newCompanyType).",
    input_schema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        title: { type: "string" },
        companyId: { type: "string" },
        companyName: { type: "string" },
        newCompanyType: { type: "string", enum: TYPE_VALUES, description: "Type for a company that doesn't exist yet. Default OPERATING_COMPANY." },
        email: { type: "string" },
        phone: { type: "string" },
        linkedinUrl: { type: "string" },
        location: { type: "string" },
        contactTypes: { type: "array", items: { type: "string" }, description: "Tags such as Operator, Founder, Advisor, Board Member, LP, Prospective LP, Co-Investor, Banker, Lender, Former Colleague." },
        relationship: { type: "string", enum: RELATIONSHIP_VALUES },
        notes: { type: "string" },
        isPrimary: { type: "boolean", description: "Make this the company's primary contact." },
      },
      required: ["firstName", "lastName"],
    },
  },
  {
    name: "update_company",
    description: "Propose changes to an existing company (the user confirms). Only include fields that change. Use a search first to get the company id.",
    input_schema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        companyName: { type: "string", description: "Used to find the company if no id." },
        status: { type: "string", enum: STATUS_VALUES },
        priority: { type: "string", enum: PRIORITY_VALUES },
        companyType: { type: "string", enum: TYPE_VALUES },
        location: { type: "string" },
        website: { type: "string" },
        linkedinUrl: { type: "string" },
        sector: { type: "string" },
        subSector: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "update_contact",
    description:
      "Propose changes to an existing contact (the user confirms). Only include fields that change. addContactTypes adds tags; contactTypes replaces all tags. Changing companyId/companyName records a job move (old company kept as a former role).",
    input_schema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        contactName: { type: "string", description: "Full name, used to find the contact if no id." },
        title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        linkedinUrl: { type: "string" },
        location: { type: "string" },
        relationship: { type: "string", enum: RELATIONSHIP_VALUES },
        contactTypes: { type: "array", items: { type: "string" } },
        addContactTypes: { type: "array", items: { type: "string" } },
        notes: { type: "string", description: "Replaces the contact's notes." },
        companyId: { type: "string" },
        companyName: { type: "string" },
        isPrimary: { type: "boolean" },
      },
    },
  },
  {
    name: "log_activity",
    description: "Propose logging an activity (email, call, meeting, LinkedIn message or note) against a company, optionally with a contact and follow-up (the user confirms).",
    input_schema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        companyName: { type: "string" },
        contactId: { type: "string" },
        contactName: { type: "string" },
        type: { type: "string", enum: INTERACTION_VALUES },
        direction: { type: "string", enum: ["OUTBOUND", "INBOUND"], description: "Default OUTBOUND." },
        date: { type: "string", description: "YYYY-MM-DD when it happened. Default today." },
        subject: { type: "string" },
        notes: { type: "string" },
        followUpDate: { type: "string", description: "YYYY-MM-DD." },
      },
      required: ["type"],
    },
  },
  {
    name: "add_note",
    description: "Propose adding a note to a company (the user confirms).",
    input_schema: {
      type: "object",
      properties: { companyId: { type: "string" }, companyName: { type: "string" }, text: { type: "string" } },
      required: ["text"],
    },
  },
];

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

// ── Lookups ────────────────────────────────────────────────────────────────

type Found<T> = { found: T } | { error: string; candidates?: unknown[] };

async function findCompany(id?: string, name?: string): Promise<Found<{ id: string; name: string; companyType: string }>> {
  const select = { id: true, name: true, companyType: true };
  if (id) {
    const c = await db.company.findUnique({ where: { id }, select });
    return c ? { found: c } : { error: `No company with id ${id}` };
  }
  if (!name) return { error: "Need a companyId or companyName" };
  const exact = await db.company.findFirst({ where: { name: ci(name) }, select });
  if (exact) return { found: exact };
  const partial = await db.company.findMany({ where: { name: { contains: name, mode: "insensitive" } }, select, take: 5 });
  if (partial.length === 1) return { found: partial[0] };
  if (partial.length > 1) return { error: `Several companies match "${name}"`, candidates: partial.map((c) => ({ id: c.id, name: c.name })) };
  return { error: `No company named "${name}"` };
}

async function findContact(id?: string, name?: string, companyId?: string): Promise<Found<{ id: string; firstName: string; lastName: string }>> {
  const select = { id: true, firstName: true, lastName: true };
  if (id) {
    const c = await db.contact.findUnique({ where: { id }, select });
    return c ? { found: c } : { error: `No contact with id ${id}` };
  }
  if (!name) return { error: "Need a contactId or contactName" };
  const parts = name.trim().split(/\s+/);
  const first = parts[0], last = parts.slice(1).join(" ");
  const matches = await db.contact.findMany({
    where: {
      ...(companyId && { OR: [{ companyId }, { affiliations: { some: { companyId } } }] }),
      firstName: { equals: first, mode: "insensitive" },
      ...(last && { lastName: { equals: last, mode: "insensitive" } }),
    },
    select, take: 5,
  });
  if (matches.length === 1) return { found: matches[0] };
  if (matches.length > 1) return { error: `Several contacts match "${name}"`, candidates: matches.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })) };
  return { error: `No contact named "${name}"${companyId ? " at that company" : ""}` };
}

// Match tags the model passes ("prospective lp") to the spelling already in use.
async function canonicalTags(tags: unknown): Promise<string[]> {
  const cleaned = cleanTags(tags);
  if (!cleaned.length) return cleaned;
  const rows = await db.contact.findMany({ select: { contactTypes: true } });
  const known = new Map<string, string>();
  for (const t of [...DEFAULT_CONTACT_TYPES, ...rows.flatMap((r) => r.contactTypes)]) if (!known.has(t.toLowerCase())) known.set(t.toLowerCase(), t);
  return cleanTags(cleaned.map((t) => known.get(t.toLowerCase()) ?? t));
}

// ── Proposals ──────────────────────────────────────────────────────────────

type Prepared = { proposal: Proposal; forModel: unknown } | { forModel: unknown; isError: true };

const newId = () => `act_${Math.random().toString(36).slice(2, 10)}`;
const fail = (forModel: unknown): Prepared => ({ forModel, isError: true });
const propose = (type: ActionType, title: string, details: [string, unknown][], payload: Record<string, unknown>, warnings: string[] = []): Prepared => {
  const proposal: Proposal = {
    id: newId(), type, title, warnings, payload,
    details: details.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([l, v]) => ({ label: l, value: String(v) })),
  };
  return {
    proposal,
    forModel: {
      status: "awaiting_user_confirmation",
      note: "Shown to the user as a card with Confirm / Cancel. Nothing is saved until they confirm. Do not say it has been added.",
      title, details: proposal.details, warnings,
    },
  };
};

export async function prepareAction(name: string, input: unknown): Promise<Prepared> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (name === "add_company") {
    const companyName = str(i.name);
    if (!companyName) return fail({ error: "name is required" });
    const website = normalizeUrl(str(i.website));
    const existing = await db.company.findFirst({
      where: { OR: [{ name: ci(companyName) }, ...(website ? [{ website }] : [])] },
      select: { id: true, name: true, status: true },
    });
    if (existing) return fail({ error: "Already in GEOS — don't add a duplicate", company: { name: existing.name, url: `/companies/${existing.id}`, status: getStatusConfig(existing.status).label } });
    const companyType = TYPE_VALUES.includes(str(i.companyType) ?? "") ? str(i.companyType)! : "OPERATING_COMPANY";
    const status = STATUS_VALUES.includes(str(i.status) ?? "") ? str(i.status)! : "IDENTIFIED";
    const priority = PRIORITY_VALUES.includes(str(i.priority) ?? "") ? str(i.priority)! : "UNKNOWN";
    const research = isOperatingCompany(companyType) && i.research !== false;
    return propose("add_company", `Add company: ${companyName}`, [
      ["Type", getCompanyTypeConfig(companyType).label],
      ["Status", label(COMPANY_STATUSES as unknown as { value: string; label: string }[], status)],
      ["Priority", priority !== "UNKNOWN" ? label(PRIORITIES, priority) : undefined],
      ["Website", website], ["Location", str(i.location)], ["Sector", str(i.sector)], ["Description", str(i.description)],
      ["Note", str(i.note)],
      ["AI research", research ? "Yes — fills profile, thesis score and founder contact" : "No"],
    ], {
      name: companyName, website, companyType, status, priority, geography: str(i.location), sector: str(i.sector),
      description: str(i.description), note: str(i.note), research,
    });
  }

  if (name === "add_contact") {
    const firstName = str(i.firstName), lastName = str(i.lastName);
    if (!firstName || !lastName) return fail({ error: "firstName and lastName are required — ask the user if unknown" });
    const warnings: string[] = [];
    let companyId: string | undefined, companyLabel: string;
    let newCompany: { name: string; companyType: string } | undefined;
    if (str(i.companyId) || str(i.companyName)) {
      const res = await findCompany(str(i.companyId), str(i.companyName));
      if ("found" in res) { companyId = res.found.id; companyLabel = res.found.name; }
      else if (str(i.companyName) && !res.candidates) {
        const type = TYPE_VALUES.includes(str(i.newCompanyType) ?? "") ? str(i.newCompanyType)! : "OPERATING_COMPANY";
        newCompany = { name: str(i.companyName)!, companyType: type };
        companyLabel = `${newCompany.name} (new ${getCompanyTypeConfig(type).label})`;
        warnings.push(`${newCompany.name} isn't in GEOS yet — it will be created as ${getCompanyTypeConfig(type).label}.`);
      } else return fail(res);
    } else return fail({ error: "Every contact needs a company — ask the user which company this person is at" });

    const email = str(i.email);
    if (email) {
      const dupe = await db.contact.findFirst({ where: { email: ci(email) }, select: { id: true, firstName: true, lastName: true } });
      if (dupe) warnings.push(`${dupe.firstName} ${dupe.lastName} already has this email — they'll be linked to this company instead of duplicated.`);
    }
    const linkedinUrl = normalizeUrl(str(i.linkedinUrl));
    const contactTypes = await canonicalTags(i.contactTypes);
    const relationship = RELATIONSHIP_VALUES.includes(str(i.relationship) ?? "") ? str(i.relationship)! : undefined;
    return propose("add_contact", `Add contact: ${firstName} ${lastName}`, [
      ["Title", str(i.title)], ["Company", companyLabel!], ["Email", email], ["Phone", str(i.phone)],
      ["LinkedIn", linkedinUrl], ["Location", str(i.location)],
      ["Contact types", contactTypes.length ? contactTypes.join(", ") : undefined],
      ["Relationship", relationship ? label(RELATIONSHIP_STRENGTHS, relationship) : undefined],
      ["Primary contact", i.isPrimary === true ? "Yes" : undefined], ["Notes", str(i.notes)],
    ], {
      firstName, lastName, title: str(i.title), email, phone: str(i.phone), linkedinUrl, location: str(i.location),
      contactTypes, relationship, notes: str(i.notes), isPrimary: i.isPrimary === true,
      ...(companyId ? { companyId } : { newCompany }),
    }, warnings);
  }

  if (name === "update_company") {
    const res = await findCompany(str(i.companyId), str(i.companyName));
    if (!("found" in res)) return fail(res);
    const current = await db.company.findUnique({ where: { id: res.found.id } });
    if (!current) return fail({ error: "Company not found" });
    const changes: Record<string, unknown> = {};
    const details: [string, unknown][] = [];
    const set = (key: string, labelText: string, value: string | undefined, from: string | null, show = (v: string | null) => v ?? "—") => {
      if (value === undefined || value === (from ?? undefined)) return;
      changes[key] = value; details.push([labelText, `${show(from)} → ${show(value)}`]);
    };
    const pick = (v: unknown, allowed: string[]) => (allowed.includes(str(v) ?? "") ? str(v) : undefined);
    set("status", "Status", pick(i.status, STATUS_VALUES), current.status, (v) => (v ? getStatusConfig(v).label : "—"));
    set("priority", "Priority", pick(i.priority, PRIORITY_VALUES), current.priority, (v) => (v ? label(PRIORITIES, v) : "—"));
    set("companyType", "Type", pick(i.companyType, TYPE_VALUES), current.companyType, (v) => (v ? getCompanyTypeConfig(v).label : "—"));
    set("geography", "Location", str(i.location), current.geography);
    set("website", "Website", normalizeUrl(str(i.website)) ?? undefined, current.website);
    set("linkedinUrl", "LinkedIn", normalizeUrl(str(i.linkedinUrl)) ?? undefined, current.linkedinUrl);
    set("sector", "Sector", str(i.sector), current.sector);
    set("subSector", "Sub-sector", str(i.subSector), current.subSector);
    set("description", "Description", str(i.description), current.description);
    if (!Object.keys(changes).length) return fail({ error: "Nothing would change — those values are already set" });
    return propose("update_company", `Update ${current.name}`, details, { companyId: current.id, companyName: current.name, changes });
  }

  if (name === "update_contact") {
    const res = await findContact(str(i.contactId), str(i.contactName));
    if (!("found" in res)) return fail(res);
    const current = await db.contact.findUnique({ where: { id: res.found.id }, include: { company: { select: { name: true } } } });
    if (!current) return fail({ error: "Contact not found" });
    const changes: Record<string, unknown> = {};
    const details: [string, unknown][] = [];
    const set = (key: string, labelText: string, value: string | undefined, from: string | null) => {
      if (value === undefined || value === (from ?? undefined)) return;
      changes[key] = value; details.push([labelText, `${from ?? "—"} → ${value}`]);
    };
    set("title", "Title", str(i.title), current.title);
    set("email", "Email", str(i.email), current.email);
    set("phone", "Phone", str(i.phone), current.phone);
    set("linkedinUrl", "LinkedIn", normalizeUrl(str(i.linkedinUrl)) ?? undefined, current.linkedinUrl);
    set("location", "Location", str(i.location), current.location);
    set("notes", "Notes", str(i.notes), current.notes);
    const rel = RELATIONSHIP_VALUES.includes(str(i.relationship) ?? "") ? str(i.relationship) : undefined;
    if (rel && rel !== current.relationship) { changes.relationship = rel; details.push(["Relationship", `${label(RELATIONSHIP_STRENGTHS, current.relationship)} → ${label(RELATIONSHIP_STRENGTHS, rel)}`]); }
    const replace = Array.isArray(i.contactTypes) ? await canonicalTags(i.contactTypes) : undefined;
    const add = await canonicalTags(i.addContactTypes);
    if (replace || add.length) {
      const next = cleanTags([...(replace ?? current.contactTypes), ...add]);
      if (next.join("|") !== current.contactTypes.join("|")) {
        changes.contactTypes = next;
        details.push(["Contact types", `${current.contactTypes.join(", ") || "—"} → ${next.join(", ") || "—"}`]);
      }
    }
    if (str(i.companyId) || str(i.companyName)) {
      const co = await findCompany(str(i.companyId), str(i.companyName));
      if (!("found" in co)) return fail(co);
      if (co.found.id !== current.companyId) {
        changes.companyId = co.found.id;
        details.push(["Company", `${current.company.name} → ${co.found.name} (${current.company.name} kept as a former role)`]);
      }
    }
    if (i.isPrimary === true && !current.isPrimary) { changes.isPrimary = true; details.push(["Primary contact", "Yes"]); }
    if (!Object.keys(changes).length) return fail({ error: "Nothing would change — those values are already set" });
    return propose("update_contact", `Update ${current.firstName} ${current.lastName}`, details, { contactId: current.id, contactName: `${current.firstName} ${current.lastName}`, changes });
  }

  if (name === "log_activity") {
    const co = await findCompany(str(i.companyId), str(i.companyName));
    if (!("found" in co)) return fail(co);
    let contact: { id: string; firstName: string; lastName: string } | undefined;
    if (str(i.contactId) || str(i.contactName)) {
      const c = await findContact(str(i.contactId), str(i.contactName), co.found.id);
      if (!("found" in c)) return fail(c);
      contact = c.found;
    }
    const type = INTERACTION_VALUES.includes(str(i.type) ?? "") ? str(i.type)! : undefined;
    if (!type) return fail({ error: `type must be one of ${INTERACTION_VALUES.join(", ")}` });
    const date = isDate(str(i.date)) ? str(i.date)! : new Date().toISOString().slice(0, 10);
    const followUpDate = isDate(str(i.followUpDate)) ? str(i.followUpDate) : undefined;
    const direction = str(i.direction) === "INBOUND" ? "INBOUND" : "OUTBOUND";
    return propose("log_activity", `Log ${label(INTERACTION_TYPES as unknown as { value: string; label: string }[], type).toLowerCase()} — ${co.found.name}`, [
      ["Date", date], ["Direction", direction === "INBOUND" ? "Inbound" : "Outbound"],
      ["With", contact ? `${contact.firstName} ${contact.lastName}` : undefined],
      ["Subject", str(i.subject)], ["Notes", str(i.notes)], ["Follow-up", followUpDate],
    ], { companyId: co.found.id, contactId: contact?.id, type, direction, date, subject: str(i.subject), content: str(i.notes), followUpDate });
  }

  if (name === "add_note") {
    const co = await findCompany(str(i.companyId), str(i.companyName));
    if (!("found" in co)) return fail(co);
    const text = str(i.text);
    if (!text) return fail({ error: "text is required" });
    return propose("add_note", `Add note — ${co.found.name}`, [["Note", text]], { companyId: co.found.id, content: text });
  }

  return fail({ error: `Unknown action ${name}` });
}

// ── Execution (after the user confirms) ────────────────────────────────────

async function callRoute(
  handler: (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>,
  path: string, method: string, body: unknown, id = "",
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const req = new NextRequest(`http://geos.internal${path}`, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  const res = await handler(req, { params: { id } });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}
const asHandler = (h: unknown) => h as (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>;
const noonUtc = (d?: unknown) => (typeof d === "string" && isDate(d) ? `${d}T12:00:00.000Z` : undefined);

export async function executeAction(type: string, payload: Record<string, unknown>): Promise<{ summary: string; url?: string }> {
  if (type === "add_company") {
    let research: Record<string, unknown> = {};
    if (payload.research) {
      const r = await callRoute(asHandler(scoutRoute), "/api/scout", "POST", { company: (payload.website as string) || payload.name });
      if (r.ok && r.data.result) research = r.data.result as Record<string, unknown>;
    }
    const given = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const created = await callRoute(asHandler(createCompanyRoute), "/api/companies", "POST", {
      ...research,
      recommendationScore: research.fitScore ?? null,
      recommendationRationale: research.fitRationale ?? null,
      ...given,
      name: payload.name,
      source: research.source ?? "Added via Ask GEOS",
    });
    if (!created.ok) throw new Error(String(created.data.error ?? "Failed to add company"));
    const id = String(created.data.id);
    if (typeof research.founderName === "string" && research.founderName.trim()) {
      const parts = research.founderName.trim().split(/\s+/);
      await callRoute(asHandler(createContactRoute), "/api/contacts", "POST", {
        firstName: parts[0], lastName: parts.slice(1).join(" ") || "-", title: research.founderTitle ?? "Founder",
        linkedinUrl: research.founderLinkedIn ?? null, email: research.founderEmail ?? null, isPrimary: true, companyId: id,
      });
    }
    if (payload.note) await callRoute(asHandler(createNoteRoute), "/api/notes", "POST", { companyId: id, content: payload.note });
    const extra = payload.research ? (Object.keys(research).length ? " with AI research" : " (research found nothing — basic details saved)") : "";
    return { summary: `Added ${payload.name}${extra}`, url: `/companies/${id}` };
  }

  if (type === "add_contact") {
    const r = await callRoute(asHandler(createContactRoute), "/api/contacts", "POST", payload);
    if (!r.ok) throw new Error(String(r.data.error ?? "Failed to add contact"));
    const name = `${r.data.firstName} ${r.data.lastName}`;
    return { summary: r.data.linkedExisting ? `Linked existing contact ${name}` : `Added ${name}`, url: `/contacts/${r.data.id}` };
  }

  if (type === "update_company") {
    const r = await callRoute(asHandler(updateCompanyRoute), `/api/companies/${payload.companyId}`, "PATCH", payload.changes, String(payload.companyId));
    if (!r.ok) throw new Error(String(r.data.error ?? "Failed to update company"));
    return { summary: `Updated ${payload.companyName}`, url: `/companies/${payload.companyId}` };
  }

  if (type === "update_contact") {
    const r = await callRoute(asHandler(updateContactRoute), `/api/contacts/${payload.contactId}`, "PATCH", payload.changes, String(payload.contactId));
    if (!r.ok) throw new Error(String(r.data.error ?? "Failed to update contact"));
    return { summary: `Updated ${payload.contactName}`, url: `/contacts/${payload.contactId}` };
  }

  if (type === "log_activity") {
    const r = await callRoute(asHandler(createInteractionRoute), "/api/interactions", "POST", {
      ...payload, date: noonUtc(payload.date), followUpDate: noonUtc(payload.followUpDate) ?? null,
    });
    if (!r.ok) throw new Error(String(r.data.error ?? "Failed to log activity"));
    return { summary: "Logged activity", url: `/companies/${payload.companyId}` };
  }

  if (type === "add_note") {
    const r = await callRoute(asHandler(createNoteRoute), "/api/notes", "POST", payload);
    if (!r.ok) throw new Error(String(r.data.error ?? "Failed to add note"));
    return { summary: "Added note", url: `/companies/${payload.companyId}` };
  }

  throw new Error(`Unknown action ${type}`);
}
