import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COMPANY_STATUSES = [
  { value: "IDENTIFIED",        label: "Identified",        color: "bg-slate-100 text-slate-700" },
  { value: "REACHED_OUT",       label: "Reached Out",       color: "bg-yellow-100 text-yellow-700" },
  { value: "IN_CONVERSATION",   label: "In Conversation",   color: "bg-orange-100 text-orange-700" },
  { value: "QUALIFYING",        label: "Qualifying",        color: "bg-blue-100 text-blue-700" },
  { value: "MEMO_CREATED",      label: "Memo Created",      color: "bg-purple-100 text-purple-700" },
  { value: "OFFER_SUBMITTED",   label: "Offer Submitted",   color: "bg-amber-100 text-amber-700" },
  { value: "DUE_DILIGENCE",     label: "In Due Diligence",  color: "bg-indigo-100 text-indigo-700" },
  { value: "PASSED",            label: "Passed",            color: "bg-red-100 text-red-700" },
  { value: "INVESTED",          label: "Invested (PortCo)", color: "bg-green-100 text-green-700" },
] as const;

// Relationship coverage: companies you know or are talking to that are not
// (yet) actionable opportunities. Shown in Companies, not on the pipeline.
export const RELATIONSHIP_STAGES = [
  "IDENTIFIED",
  "REACHED_OUT",
  "IN_CONVERSATION",
] as const;

// Actionable opportunities only — what appears on the Pipeline.
export const PIPELINE_STAGES = [
  "QUALIFYING",
  "MEMO_CREATED",
  "OFFER_SUBMITTED",
  "DUE_DILIGENCE",
] as const;

export const INTERACTION_TYPES = [
  { value: "EMAIL", label: "Email" },
  { value: "LINKEDIN_MESSAGE", label: "LinkedIn Message" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
] as const;

export const SECTORS = [
  "B2B SaaS",
  "FinTech",
  "HealthTech",
  "HR Tech",
  "MarTech",
  "EdTech",
  "CyberSecurity",
  "DevTools",
  "Supply Chain",
  "Legal Tech",
  "PropTech",
  "Data & Analytics",
  "Infrastructure",
  "Other",
] as const;

export const STAGES = [
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Growth",
] as const;

export const PRIORITIES = [
  { value: "CONVICTION", label: "Conviction", color: "bg-violet-100 text-violet-700 border-violet-300", dot: "bg-violet-500" },
  { value: "HIGH",       label: "High",       color: "bg-red-100 text-red-700 border-red-300",         dot: "bg-red-500"    },
  { value: "MEDIUM",     label: "Medium",     color: "bg-amber-100 text-amber-700 border-amber-300",   dot: "bg-amber-400"  },
  { value: "LOW",        label: "Low",        color: "bg-slate-100 text-slate-500 border-slate-300",   dot: "bg-slate-300"  },
  { value: "UNKNOWN",    label: "Unknown",    color: "bg-slate-50 text-slate-400 border-slate-200",    dot: "bg-slate-200"  },
];

export const COMPANY_TYPES = [
  { value: "OPERATING_COMPANY", label: "Operating Company", color: "bg-blue-50 text-blue-700 border-blue-200"         },
  { value: "INVESTMENT_FIRM",   label: "Investment Firm",   color: "bg-violet-50 text-violet-700 border-violet-200"   },
  { value: "INVESTMENT_BANK",   label: "Investment Bank",   color: "bg-indigo-50 text-indigo-700 border-indigo-200"   },
  { value: "BANK_LENDER",       label: "Bank Lender",       color: "bg-teal-50 text-teal-700 border-teal-200"         },
  { value: "NON_BANK_LENDER",   label: "Non-Bank Lender",   color: "bg-cyan-50 text-cyan-700 border-cyan-200"         },
  { value: "LIMITED_PARTNER",   label: "Limited Partner",   color: "bg-amber-50 text-amber-700 border-amber-200"      },
  { value: "PROSPECTIVE_LP",    label: "Prospective Limited Partner", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "LAW_FIRM",          label: "Law Firm",          color: "bg-slate-50 text-slate-600 border-slate-200"      },
  { value: "ACCOUNTING_FIRM",   label: "Accounting Firm",   color: "bg-slate-50 text-slate-600 border-slate-200"      },
  { value: "ADVISORY_FIRM",     label: "Advisory / Consulting", color: "bg-slate-50 text-slate-600 border-slate-200"  },
  { value: "OTHER",             label: "Other",             color: "bg-slate-50 text-slate-500 border-slate-200"      },
];

export function getCompanyTypeConfig(type: string | null | undefined) {
  return COMPANY_TYPES.find(t => t.value === type) ?? COMPANY_TYPES[0];
}

// Only operating companies are investment targets; everything else
// (banks, firms, LPs) is a relationship, not a deal.
export function isOperatingCompany(type: string | null | undefined) {
  return !type || type === "OPERATING_COMPANY";
}

export const RELATIONSHIP_STRENGTHS = [
  { value: "STRONG",  label: "Strong",  color: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
  { value: "WARM",    label: "Warm",    color: "bg-amber-100 text-amber-700 border-amber-300",       dot: "bg-amber-400"   },
  { value: "COLD",    label: "Cold",    color: "bg-sky-100 text-sky-700 border-sky-300",             dot: "bg-sky-400"     },
  { value: "UNKNOWN", label: "Unknown", color: "bg-slate-50 text-slate-400 border-slate-200",        dot: "bg-slate-200"   },
];

export function getRelationshipConfig(value: string | null | undefined) {
  return RELATIONSHIP_STRENGTHS.find(r => r.value === value) ?? RELATIONSHIP_STRENGTHS[RELATIONSHIP_STRENGTHS.length - 1];
}

export function getPriorityConfig(priority: string) {
  return PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[PRIORITIES.length - 1];
}

export function getStatusConfig(status: string) {
  return (
    COMPANY_STATUSES.find((s) => s.value === status) ?? COMPANY_STATUSES[0]
  );
}

export function formatARR(arr: number | null | undefined): string {
  if (!arr) return "Unknown";
  if (arr >= 1000) return `$${(arr / 1000).toFixed(1)}B`;
  return `$${arr.toFixed(1)}M`;
}

export function formatGrowth(growth: number | null | undefined): string {
  if (growth === null || growth === undefined) return "Unknown";
  return `${growth > 0 ? "+" : ""}${growth.toFixed(0)}%`;
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-green-600";
  if (score >= 4) return "text-yellow-600";
  return "text-red-600";
}

export function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-50 border-emerald-200";
  if (score >= 6) return "bg-green-50 border-green-200";
  if (score >= 4) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

// <input type="date"> values are "YYYY-MM-DD". new Date() on that string is
// UTC midnight, which displays as the previous day west of UTC, so picked
// days are anchored at local noon. Picking today keeps the current time.
export function dateInputToISO(value: string): string {
  if (value === toDateInputValue(new Date())) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
}

export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Contact types are free-form tags; these are always offered as options.
export const DEFAULT_CONTACT_TYPES = [
  "Operator",
  "Founder",
  "Advisor",
  "Board Member",
  "LP",
  "Prospective LP",
  "Co-Investor",
  "Banker",
  "Lender",
  "Former Colleague",
];

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-lime-100 text-lime-800 border-lime-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-pink-100 text-pink-800 border-pink-200",
];

// Same tag always gets the same color, including tags users create.
export function tagColor(tag: string): string {
  const preset = DEFAULT_CONTACT_TYPES.findIndex((t) => t.toLowerCase() === tag.toLowerCase());
  if (preset !== -1) return TAG_COLORS[preset % TAG_COLORS.length];
  let hash = 0;
  for (const ch of tag.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

// Trims, drops blanks, and de-duplicates case-insensitively (first spelling wins).
export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const v = t.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}
