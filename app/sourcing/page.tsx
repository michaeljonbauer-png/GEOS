"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles, ThumbsDown, ThumbsUp, ExternalLink, Building2, BookmarkPlus,
  RotateCcw, ChevronDown, ChevronUp, History, Trash2, Clock, ArrowRight,
  Ban, AlertCircle, Search, Loader2, Settings2, Target, Radar,
  CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow, CompanyPreviewModal, type CompanyPreviewData } from "@/components/sourcing/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  name: string; inputName?: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  founded: number | null; stage: string | null; totalFundingM: number | null;
  employees: number | null; arrEstimate: number | null; arrGrowth: number | null;
  nrrEstimate?: number | null; grossMargin?: number | null;
  acquired?: boolean; acquiredBy?: string | null; acquisitionUncertain?: boolean;
  huntScore?: number | null; huntRationale?: string | null;
  fitScore?: number | null; fitRationale?: string | null;
  source?: string | null;
  founderName?: string | null; founderTitle?: string | null;
  founderLinkedIn?: string | null; founderEmail?: string | null;
  error?: string; _mode?: "hunt" | "scout";
}

interface Lead {
  id: string; name: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  arrEstimate: number | null; arrGrowth: number | null; employees: number | null;
  stage: string | null; source: string | null;
  recommendationRationale: string | null; recommendationScore: number | null;
  scoreBreakdown: string | null;
}

interface ScoreCriterion { criterion: string; met: boolean; score: number; note: string; }

interface SessionMeta {
  id: string; query: string; resultCount: number; createdAt: string;
  type?: "HUNT" | "SCOUT";
}

interface Prefs {
  businessModel: string; endMarkets: string; softwareType: string;
  targetStages: string; minArrM: number | null; maxArrM: number | null;
  minEmployees: number | null; maxEmployees: number | null;
  maxFundingM: number | null; minFoundedYear: number | null;
  maxFoundedYear: number | null; additionalNotes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: Prefs = {
  businessModel: "B2B", endMarkets: "[]", softwareType: "", targetStages: "[]",
  minArrM: null, maxArrM: null, minEmployees: null, maxEmployees: null,
  maxFundingM: null, minFoundedYear: null, maxFoundedYear: null, additionalNotes: "",
};

const ALL_END_MARKETS = [
  "Construction", "Manufacturing", "Healthcare", "Financial Services",
  "Real Estate", "Logistics & Supply Chain", "Legal & Compliance",
  "Field Services", "Agriculture", "Energy & Utilities",
  "Professional Services", "Retail & Hospitality", "Government & Public Sector",
  "Education", "Insurance", "HR & Workforce Management",
];

const ALL_STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth / Pre-IPO", "Bootstrapped"];

const URL_REGEX = /^https?:\/\//i;
const DOMAIN_REGEX = /^[\w-]+\.\w{2,}(\/|$)/i;
const QUEUE_TARGET = 9;

// Words that indicate a descriptive search query rather than a company name
const CRITERIA_REGEX = /\b(compan(y|ies)|founded|raised?|funding|revenue|arr|employees?|software|saas|platforms?|vertical|horizontal|b2b|b2c|enterprise|startups?|between|under|over|less than|more than|that|which|with|serving|providing|industry|market|stage|series [a-c]|seed|bootstrapped)\b/i;

// Detect whether the input is a specific-company lookup (scout) or a
// free-form criteria search (hunt). URLs/domains are always scout; text with
// descriptive/criteria words is hunt; otherwise short proper-noun-style
// entries are treated as company names.
function isScoutInput(text: string) {
  const lines = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return false;
  if (lines.some(l => URL_REGEX.test(l) || DOMAIN_REGEX.test(l))) return true;
  if (CRITERIA_REGEX.test(text)) return false;
  return lines.every(l => l.split(/\s+/).length <= 4);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3600000;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBreakdownPanel({ breakdown }: { breakdown: string }) {
  const [open, setOpen] = useState(false);
  let criteria: ScoreCriterion[] = [];
  try { criteria = JSON.parse(breakdown); } catch { return null; }
  if (!criteria.length) return null;
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors w-full">
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Score breakdown
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border border-slate-100 rounded-lg p-2.5 bg-slate-50">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              {c.met ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={12} className="text-slate-300 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-700 truncate">{c.criterion}</span>
                  <span className={`text-[10px] font-bold tabular-nums shrink-0 ${c.score >= 70 ? "text-emerald-600" : c.score >= 40 ? "text-amber-600" : "text-red-400"}`}>{c.score}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-5 animate-pulse flex flex-col gap-3">
      <div className="flex justify-between"><div className="h-4 bg-slate-100 rounded w-36" /><div className="h-4 bg-slate-100 rounded w-12" /></div>
      <div className="flex gap-1"><div className="h-3.5 bg-slate-100 rounded w-20" /><div className="h-3.5 bg-slate-100 rounded w-16" /></div>
      <div className="space-y-1.5"><div className="h-3 bg-slate-100 rounded w-full" /><div className="h-3 bg-slate-100 rounded w-5/6" /><div className="h-3 bg-slate-100 rounded w-4/6" /></div>
      <div className="h-16 bg-violet-50 rounded-lg" />
      <div className="flex gap-2 mt-auto pt-1"><div className="h-8 bg-slate-100 rounded flex-1" /><div className="h-8 bg-slate-100 rounded flex-1" /><div className="h-8 bg-slate-100 rounded w-8" /></div>
    </div>
  );
}

function ResultCard({ result, onOpenDetail, onAdd, onSave, onDismiss, adding, dismissed, addedId, addedType }: {
  result: SearchResult; onOpenDetail: () => void; onAdd: () => void; onSave: () => void;
  onDismiss: () => void; adding: boolean; dismissed: boolean;
  addedId: string | null; addedType: "pipeline" | "watchlist" | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isScout = result._mode === "scout";
  const score = result.fitScore ?? result.huntScore ?? null;
  const rationale = result.fitRationale ?? result.huntRationale ?? null;
  const rationaleLabel = result.fitRationale ? "Thesis fit" : "Why it matches";

  if (addedId) {
    const isPipeline = addedType === "pipeline";
    return (
      <div className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${isPipeline ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${isPipeline ? "text-emerald-800" : "text-slate-700"}`}>{result.name}</p>
          <p className={`text-xs mt-0.5 ${isPipeline ? "text-emerald-600" : "text-slate-500"}`}>{isPipeline ? "Added to pipeline" : "Saved to Companies"}</p>
        </div>
        <Link href={`/companies/${addedId}`} className={`flex items-center gap-1 text-xs font-medium shrink-0 ${isPipeline ? "text-emerald-700 hover:text-emerald-900" : "text-slate-600 hover:text-slate-900"}`}>
          View profile <ArrowRight size={12} />
        </Link>
      </div>
    );
  }
  if (dismissed) return null;
  if (result.error) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-2"><AlertCircle size={14} className="text-slate-400" /><h3 className="font-medium text-slate-500 text-sm">{result.inputName ?? result.name}</h3></div>
        <p className="text-xs text-slate-400">{result.error}</p>
      </div>
    );
  }
  if (result.acquired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 opacity-80">
        <Ban size={15} className="text-red-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-800 truncate">{result.name}</p>
          <p className="text-xs text-red-600 mt-0.5">Acquired{result.acquiredBy ? ` by ${result.acquiredBy}` : ""} — not an investable opportunity</p>
        </div>
        <Button size="sm" variant="ghost" className="px-1.5 text-slate-400 shrink-0" onClick={onDismiss}><ThumbsDown size={12} /></Button>
      </div>
    );
  }

  const descLong = (result.description ?? "").length > 180;
  const accentColor = isScout ? "text-emerald-700 group-hover:text-emerald-900 decoration-emerald-200 group-hover:decoration-emerald-500" : "text-blue-700 group-hover:text-blue-900 decoration-blue-200 group-hover:decoration-blue-500";
  const tagBg = isScout ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100";
  const rationaleBg = isScout ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100";
  const rationaleText = isScout ? "text-emerald-900" : "text-blue-900";
  const rationaleLabelColor = isScout ? "text-emerald-600" : "text-blue-500";
  const btnColor = isScout ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <button onClick={onOpenDetail} className="text-left w-full group">
            <h3 className={`font-semibold underline underline-offset-2 truncate text-sm transition-colors ${accentColor}`}>{result.name}</h3>
          </button>
          <p className="text-[11px] text-slate-400 mt-0.5">{[result.geography, result.stage, result.founded ? `Founded ${result.founded}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <ScoreBadge score={score} label={result.fitScore != null ? "fit" : "match"} />
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {result.sector && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${tagBg}`}>{result.sector}</span>}
        {result.subSector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">{result.subSector}</span>}
      </div>
      {result.description && (
        <div className="mb-3">
          <p className={`text-xs text-slate-500 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{result.description}</p>
          {descLong && (
            <button onClick={() => setExpanded(v => !v)} className="mt-1 text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium">
              {expanded ? <><ChevronUp size={11} />Show less</> : <><ChevronDown size={11} />Show more</>}
            </button>
          )}
        </div>
      )}
      {rationale && (
        <div className={`border rounded-lg px-3 py-2.5 mb-3 ${rationaleBg}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${rationaleLabelColor}`}>{rationaleLabel}</p>
          <p className={`text-xs leading-relaxed ${expanded ? "" : "line-clamp-2"} ${rationaleText}`}>{rationale}</p>
        </div>
      )}
      <MetricRow arrEstimate={result.arrEstimate} arrGrowth={result.arrGrowth} employees={result.employees} />
      {result.totalFundingM != null && <p className="text-[10px] text-slate-400 mb-3">Total raised: <span className="font-medium text-slate-600">${result.totalFundingM}M</span></p>}
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className={`flex-1 text-white text-xs ${btnColor}`} onClick={onOpenDetail}><Search size={12} className="mr-1" />View details</Button>
        <Button size="sm" variant="outline" className="px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={onAdd} disabled={adding} title="Add to pipeline"><Building2 size={12} /></Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-500 border-slate-200 hover:bg-slate-50" onClick={onSave} disabled={adding} title="Save to Companies"><BookmarkPlus size={12} /></Button>
        {result.website && <a href={result.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="px-2.5"><ExternalLink size={12} /></Button></a>}
        <Button size="sm" variant="outline" className="px-2.5 text-slate-400 hover:bg-slate-50" onClick={onDismiss} title="Dismiss"><ThumbsDown size={12} /></Button>
      </div>
    </div>
  );
}

function LeadCard({ lead, onPursue, onSave, onPass, onRefresh, processing, refreshing }: {
  lead: Lead; onPursue: () => void; onSave: () => void; onPass: () => void; onRefresh: () => void;
  processing: boolean; refreshing: boolean;
}) {
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/companies/${lead.id}`)} className={`relative bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 cursor-pointer ${processing ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"} ${refreshing ? "ring-2 ring-violet-300 ring-offset-1" : ""}`}>
      {refreshing && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-violet-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
            <Search size={12} className="animate-pulse" /> Refreshing from the web…
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm">{lead.name}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{[lead.geography, lead.stage].filter(Boolean).join(" · ")}</p>
        </div>
        <ScoreBadge score={lead.recommendationScore} />
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {lead.sector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium border border-violet-100">{lead.sector}</span>}
        {lead.subSector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">{lead.subSector}</span>}
      </div>
      {lead.description && <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">{lead.description}</p>}
      {lead.recommendationRationale && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mb-1">Why it fits</p>
          <p className="text-xs text-violet-900 leading-relaxed">{lead.recommendationRationale}</p>
        </div>
      )}
      {lead.scoreBreakdown && <ScoreBreakdownPanel breakdown={lead.scoreBreakdown} />}
      <MetricRow arrEstimate={lead.arrEstimate} arrGrowth={lead.arrGrowth} employees={lead.employees} />
      {lead.source && <p className="text-[10px] text-slate-400 mb-3 flex items-center gap-1"><AlertCircle size={9} className="shrink-0" />AI estimate · verify via {lead.source}</p>}
      <div className="flex flex-col gap-2 mt-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onRefresh} disabled={refreshing} className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-md py-1 transition-colors disabled:opacity-50">
          <Search size={10} className={refreshing ? "animate-pulse" : ""} />
          {refreshing ? "Verifying with live web data…" : "Refresh with live web data"}
        </button>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={onPursue}><ThumbsUp size={12} className="mr-1" />Pursue</Button>
          <Button size="sm" variant="outline" className="px-2.5 text-slate-500 border-slate-200 hover:bg-slate-50" onClick={onSave}><BookmarkPlus size={12} /></Button>
          <Button size="sm" variant="outline" className="flex-1 text-red-500 hover:bg-red-50 border-red-200 text-xs" onClick={onPass}><ThumbsDown size={12} className="mr-1" />Pass</Button>
        </div>
      </div>
    </div>
  );
}

function TagToggle({ value, label, selected, onToggle }: { value: string; label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}>
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HuntPage() {
  const { toast } = useToast();

  // Search state
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hunt" | "scout">("hunt");
  const [searching, setSearching] = useState(false);
  const [scoutProgress, setScoutProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedCompanies, setAddedCompanies] = useState<Map<string, { id: string; type: "pipeline" | "watchlist" }>>(new Map());
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [activeSessionDate, setActiveSessionDate] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"leads" | "search">("leads");
  const generatingRef = useRef(false);

  // History
  const [history, setHistory] = useState<SessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyFilter, setHistoryFilter] = useState("");

  // Preferences
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Auto-detect scout mode from URL/domain patterns
  useEffect(() => {
    if (query.trim()) setMode(isScoutInput(query) ? "scout" : "hunt");
  }, [query]);

  // Fetch leads
  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; if (d.error) setGenerateError(d.error); return []; }
      return res.json();
    } catch { return []; }
  }, []);

  // Fetch combined history
  const fetchHistory = useCallback(async () => {
    try {
      const [huntRes, scoutRes] = await Promise.all([fetch("/api/hunt"), fetch("/api/scout/sessions")]);
      const huntData = huntRes.ok ? await huntRes.json() : { sessions: [] };
      const scoutData = scoutRes.ok ? await scoutRes.json() : { sessions: [] };
      const huntSessions: SessionMeta[] = (huntData.sessions ?? []).map((s: SessionMeta) => ({ ...s, type: "HUNT" as const }));
      const scoutSessions: SessionMeta[] = (scoutData.sessions ?? []).map((s: SessionMeta) => ({ ...s, type: "SCOUT" as const }));
      const merged = [...huntSessions, ...scoutSessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(merged);
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeads().then(data => { setLeads(data); setLeadsLoading(false); });
    fetch("/api/sourcing-prefs").then(r => r.json()).then(data => setPrefs(p => ({ ...p, ...data }))).catch(() => {});
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async (session: SessionMeta) => {
    try {
      const res = await fetch(`/api/hunt/${session.id}`);
      const data = await res.json();
      const results: SearchResult[] = (data.results ?? []).map((r: SearchResult) => ({ ...r, inputName: r.name, _mode: session.type === "SCOUT" ? "scout" as const : "hunt" as const }));
      setSearchResults(results);
      setLastQuery(session.query);
      setQuery(session.query);
      setDismissed(new Set());
      setAddedCompanies(new Map());
      setActiveSessionDate(session.createdAt);
      setHistoryOpen(false);
      setActiveView("search");
    } catch { toast({ title: "Failed to load session", variant: "destructive" }); }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await fetch(`/api/hunt/${id}`, { method: "DELETE" }); setHistory(prev => prev.filter(s => s.id !== id)); }
    catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  // ── Search ──
  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true); setSearchResults([]); setDismissed(new Set()); setAddedCompanies(new Map());
    setActiveSessionDate(null); setHistoryOpen(false); setActiveView("search"); setSearchError(null);

    if (mode === "scout") {
      const companies = query.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).slice(0, 20);
      const newResults: SearchResult[] = [];
      for (let i = 0; i < companies.length; i++) {
        const name = companies[i];
        setScoutProgress({ current: i + 1, total: companies.length, name });
        try {
          const res = await fetch("/api/scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: name }) });
          const data = await res.json();
          const r: SearchResult = res.ok && data.result
            ? { ...data.result, inputName: name, _mode: "scout" as const }
            : { name, inputName: name, website: null, description: null, sector: null, subSector: null, geography: null, founded: null, stage: null, totalFundingM: null, employees: null, arrEstimate: null, arrGrowth: null, _mode: "scout" as const, error: data.error ?? "Could not research this company" };
          newResults.push(r);
          setSearchResults(prev => [...prev, r]);
        } catch (err) {
          const r: SearchResult = { name, inputName: name, website: null, description: null, sector: null, subSector: null, geography: null, founded: null, stage: null, totalFundingM: null, employees: null, arrEstimate: null, arrGrowth: null, _mode: "scout" as const, error: err instanceof Error ? err.message : "Network error" };
          newResults.push(r);
          setSearchResults(prev => [...prev, r]);
        }
      }
      setScoutProgress(null);
      setLastQuery(companies.join(", "));
      setActiveSessionDate(new Date().toISOString());
      const successful = newResults.filter(r => !r.error);
      if (successful.length > 0) {
        fetch("/api/scout/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: companies.join(", "), results: successful }) })
          .then(() => fetchHistory()).catch(() => {});
      }
    } else {
      try {
        const res = await fetch("/api/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), count: 6 }) });
        const data = await res.json() as { results?: SearchResult[]; error?: string; query?: string };
        if (!res.ok) { setSearchError(data.error ?? "Hunt failed"); setSearching(false); return; }
        const results = (data.results ?? []).map(r => ({ ...r, _mode: "hunt" as const }));
        setSearchResults(results);
        setLastQuery(data.query ?? query.trim());
        setActiveSessionDate(new Date().toISOString());
        if (results.length === 0) toast({ title: "No results", description: "Try rephrasing or broadening the criteria." });
        fetchHistory();
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Network error");
      }
    }
    setSearching(false);
  };

  // ── Add company ──
  const addCompany = async (result: SearchResult, type: "pipeline" | "watchlist"): Promise<string | null> => {
    setAddingId(result.name);
    try {
      const status = type === "pipeline" ? "IDENTIFIED" : "WATCHLIST";
      const score = result.fitScore ?? result.huntScore ?? null;
      const rationale = result.fitRationale ?? result.huntRationale ?? null;
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, website: result.website, description: result.description, sector: result.sector, subSector: result.subSector, geography: result.geography, founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM, employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth, nrrEstimate: result.nrrEstimate, grossMargin: result.grossMargin, status, priority: "UNKNOWN", source: result.source ?? (result._mode === "scout" ? "Scout: web-verified" : `Hunt: ${lastQuery}`), recommendationScore: score, recommendationRationale: rationale }),
      });
      const data = await res.json();
      if (!res.ok) {
        const search = await fetch(`/api/companies?search=${encodeURIComponent(result.name)}`);
        if (search.ok) {
          const existing: Array<{ id: string; name: string }> = await search.json();
          const match = existing.find(c => c.name.toLowerCase() === result.name.toLowerCase());
          if (match) { const m = new Map(addedCompanies); m.set(result.name, { id: match.id, type }); setAddedCompanies(m); return match.id; }
        }
        throw new Error(data.error ?? "Server error");
      }
      const m = new Map(addedCompanies); m.set(result.name, { id: data.id, type }); setAddedCompanies(m);
      if (result.founderName) {
        const parts = result.founderName.trim().split(/\s+/);
        fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: parts[0], lastName: parts.slice(1).join(" ") || "-", title: result.founderTitle ?? "Founder", linkedinUrl: result.founderLinkedIn ?? null, email: result.founderEmail ?? null, isPrimary: true, companyId: data.id }) }).catch(() => {});
      }
      toast({ title: type === "pipeline" ? `${result.name} added to pipeline` : `${result.name} saved to Companies` });
      return data.id;
    } catch (err) {
      toast({ title: "Failed to save company", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
      return null;
    } finally { setAddingId(null); }
  };

  // ── Leads ──
  const topUp = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true); setGenerateError(null);
    try {
      const res = await fetch("/api/leads/generate", { method: "POST" });
      const data = await res.json() as { generated?: number; message?: string; error?: string };
      if (!res.ok) { const msg = data.error ?? "Unknown error"; setGenerateError(msg); toast({ title: "Could not generate leads", description: msg, variant: "destructive" }); return; }
      if (data.generated === 0 && data.message) toast({ title: data.message });
      setLeads(await fetchLeads());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setGenerateError(msg); toast({ title: "Could not generate leads", description: msg, variant: "destructive" });
    } finally { setGenerating(false); generatingRef.current = false; }
  }, [fetchLeads, toast]);

  const refreshLead = async (lead: Lead) => {
    setRefreshingId(lead.id);
    try {
      const res = await fetch(`/api/companies/${lead.id}/refresh`, { method: "POST" });
      const data = await res.json() as { company?: Lead; changed?: string[]; notes?: string; error?: string };
      if (!res.ok) { toast({ title: "Refresh failed", description: data.error ?? "Unknown error", variant: "destructive" }); return; }
      if (data.company) setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...data.company! } : l));
      const n = data.changed?.length ?? 0;
      toast({ title: n > 0 ? `Updated ${lead.name}` : `No changes for ${lead.name}`, description: data.notes ?? (n > 0 ? `Refreshed ${n} fields.` : "Existing data appears current.") });
    } catch (err) { toast({ title: "Refresh failed", description: err instanceof Error ? err.message : "Network error", variant: "destructive" }); }
    finally { setRefreshingId(null); }
  };

  const processLead = async (lead: Lead, action: "pursue" | "save" | "pass") => {
    setProcessingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) throw new Error();
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      const msg = action === "pursue" ? { title: `${lead.name} added to pipeline`, description: "Now visible in Companies as Identified." } : action === "save" ? { title: `${lead.name} saved to Companies`, description: "Stored as Watchlist — not an active pipeline opp." } : { title: `Passed on ${lead.name}`, description: "Feedback recorded — finding a replacement…" };
      toast(msg); topUp();
    } catch { toast({ title: "Action failed", variant: "destructive" }); }
    finally { setProcessingId(null); }
  };

  // ── Preferences ──
  const savePrefs = async () => {
    setSavingPrefs(true);
    try { await fetch("/api/sourcing-prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) }); toast({ title: "Preferences saved" }); }
    catch { toast({ title: "Failed to save preferences", variant: "destructive" }); }
    finally { setSavingPrefs(false); }
  };

  const parseList = (s: string): string[] => { try { return JSON.parse(s); } catch { return []; } };
  const toggleList = (field: "endMarkets" | "targetStages", value: string) => {
    const list = parseList(prefs[field]);
    const next = list.includes(value) ? list.filter(x => x !== value) : [...list, value];
    setPrefs(p => ({ ...p, [field]: JSON.stringify(next) }));
  };

  // ── Derived ──
  const hasSearchResults = searchResults.length > 0;
  const visibleSearchCount = searchResults.filter(r => !dismissed.has(r.name) || addedCompanies.has(r.name)).length;
  const previewAdded = previewResult ? (addedCompanies.get(previewResult.name) ?? null) : null;
  const skeletonCount = generating ? Math.max(0, QUEUE_TARGET - leads.length) : 0;
  const endMarketsList = parseList(prefs.endMarkets);
  const targetStagesList = parseList(prefs.targetStages);
  const filteredHistory = historyFilter.trim()
    ? history.filter(s => s.query.toLowerCase().includes(historyFilter.trim().toLowerCase()))
    : history;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Hunt</h1>
        <p className="text-sm text-slate-500">
          Describe what you're looking for, or look up a specific company — AI finds and scores matches against your thesis
        </p>
      </div>

      {/* Search box */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <textarea
          className="w-full text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none leading-relaxed"
          rows={3}
          placeholder={'Either describe what you\'re looking for — e.g. "Vertical SaaS for construction, founded between 2020 and 2023, raised less than $5M to date" — and I\'ll search for relevant companies, OR enter a company name / URL to look up a specific company.'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) search(); }}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 hidden sm:block">⌘+Enter to run</p>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowPrefs(v => !v)} variant="outline" size="sm" className="text-slate-500">
              <Settings2 size={13} className="mr-1" />Preferences
            </Button>
            <Button onClick={search} disabled={searching || !query.trim()} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              {searching
                ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Searching…</>
                : <><Search size={13} className="mr-1.5" />Search</>
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Preferences panel */}
      {showPrefs && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Settings2 size={14} className="text-slate-400" />Sourcing Preferences</h2>
            <p className="text-[11px] text-slate-400">Used by Auto Generate Leads to match your thesis</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Business Model</label>
              <div className="flex gap-1.5 flex-wrap">{["B2B", "B2C", "Both"].map(bm => <TagToggle key={bm} value={bm} label={bm} selected={prefs.businessModel === bm} onToggle={() => setPrefs(p => ({ ...p, businessModel: bm }))} />)}</div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Software Type</label>
              <input type="text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300 text-slate-700" placeholder="e.g. Vertical SaaS, Mission-critical ERP…" value={prefs.softwareType} onChange={e => setPrefs(p => ({ ...p, softwareType: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">ARR Range ($M)</label>
              <div className="flex items-center gap-2">
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="Min" value={prefs.minArrM ?? ""} onChange={e => setPrefs(p => ({ ...p, minArrM: e.target.value ? Number(e.target.value) : null }))} />
                <span className="text-slate-300 text-xs">–</span>
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="Max" value={prefs.maxArrM ?? ""} onChange={e => setPrefs(p => ({ ...p, maxArrM: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Employee Range</label>
              <div className="flex items-center gap-2">
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="Min" value={prefs.minEmployees ?? ""} onChange={e => setPrefs(p => ({ ...p, minEmployees: e.target.value ? Number(e.target.value) : null }))} />
                <span className="text-slate-300 text-xs">–</span>
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="Max" value={prefs.maxEmployees ?? ""} onChange={e => setPrefs(p => ({ ...p, maxEmployees: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Max Total Funding ($M)</label>
              <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="e.g. 20" value={prefs.maxFundingM ?? ""} onChange={e => setPrefs(p => ({ ...p, maxFundingM: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Founded Year Range</label>
              <div className="flex items-center gap-2">
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="2018" value={prefs.minFoundedYear ?? ""} onChange={e => setPrefs(p => ({ ...p, minFoundedYear: e.target.value ? Number(e.target.value) : null }))} />
                <span className="text-slate-300 text-xs">–</span>
                <input type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300" placeholder="2024" value={prefs.maxFoundedYear ?? ""} onChange={e => setPrefs(p => ({ ...p, maxFoundedYear: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Target Stages</label>
            <div className="flex flex-wrap gap-1.5">{ALL_STAGES.map(s => <TagToggle key={s} value={s} label={s} selected={targetStagesList.includes(s)} onToggle={() => toggleList("targetStages", s)} />)}</div>
          </div>
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">End Markets</label>
            <div className="flex flex-wrap gap-1.5">{ALL_END_MARKETS.map(m => <TagToggle key={m} value={m} label={m} selected={endMarketsList.includes(m)} onToggle={() => toggleList("endMarkets", m)} />)}</div>
          </div>
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Additional Notes</label>
            <textarea className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300 resize-none text-slate-700" rows={2} placeholder="e.g. founder-led only, no PE-backed, mission-critical software, US-based…" value={prefs.additionalNotes} onChange={e => setPrefs(p => ({ ...p, additionalNotes: e.target.value }))} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={savePrefs} disabled={savingPrefs} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">{savingPrefs ? "Saving…" : "Save Preferences"}</Button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {searchError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-700">Search failed</p>
            <p className="text-xs text-red-600 mt-0.5">{searchError}</p>
            <button onClick={() => setSearchError(null)} className="mt-1.5 text-xs font-medium text-red-700 underline hover:no-underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Scout progress */}
      {scoutProgress && (
        <div className="flex items-center gap-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <Loader2 size={14} className="text-emerald-500 animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-800">Researching {scoutProgress.current} of {scoutProgress.total}: {scoutProgress.name}</p>
            <div className="mt-1.5 h-1 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${(scoutProgress.current / scoutProgress.total) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH RESULTS ── */}
      {activeView === "search" && (
        <>
          {searching && mode === "hunt" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-dashed border-slate-200 rounded-xl p-5 animate-pulse flex flex-col gap-3">
                  <div className="flex justify-between"><div className="h-4 bg-slate-100 rounded w-36" /><div className="h-4 bg-slate-100 rounded w-14" /></div>
                  <div className="space-y-1.5"><div className="h-3 bg-slate-100 rounded w-full" /><div className="h-3 bg-slate-100 rounded w-5/6" /></div>
                  <div className="h-16 bg-blue-50 rounded-lg" />
                  <div className="flex gap-2 mt-auto"><div className="h-8 bg-slate-100 rounded flex-1" /><div className="h-8 bg-slate-100 rounded flex-1" /></div>
                </div>
              ))}
            </div>
          )}
          {hasSearchResults && !searching && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">{visibleSearchCount} result{visibleSearchCount !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    {activeSessionDate && <><Clock size={10} />{formatDate(activeSessionDate)} · </>}
                    <span className="line-clamp-1">"{lastQuery}"</span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSearchResults([]); setQuery(""); setLastQuery(""); setDismissed(new Set()); setHistoryOpen(true); setActiveView("leads"); }} className="text-slate-500">
                  <RotateCcw size={13} className="mr-1.5" />Clear
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {searchResults.map((result, i) => (
                  <ResultCard
                    key={`${result.name}-${i}`}
                    result={result}
                    onOpenDetail={() => setPreviewResult(result)}
                    onAdd={() => addCompany(result, "pipeline")}
                    onSave={() => addCompany(result, "watchlist")}
                    onDismiss={() => { const s = new Set(dismissed); s.add(result.name); setDismissed(s); }}
                    adding={addingId === result.name}
                    dismissed={dismissed.has(result.name)}
                    addedId={addedCompanies.get(result.name)?.id ?? null}
                    addedType={addedCompanies.get(result.name)?.type ?? null}
                  />
                ))}
              </div>
              {visibleSearchCount === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm mb-8">
                  All results dismissed. <button className="text-blue-600 hover:underline" onClick={() => { setSearchResults([]); setQuery(""); setActiveView("leads"); }}>Back to leads</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── LEADS VIEW ── */}
      {activeView === "leads" && (
        <div>
          {generateError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-700">Lead generation failed</p>
                <p className="text-xs text-red-600 mt-0.5">{generateError}</p>
                <button onClick={() => { setGenerateError(null); topUp(); }} className="mt-2 text-xs font-medium text-red-700 underline hover:no-underline">Try again</button>
              </div>
            </div>
          )}
          {leadsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: QUEUE_TARGET }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}
          {!leadsLoading && leads.length === 0 && !generating && (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 mx-auto mb-4"><Sparkles className="text-violet-500" size={28} /></div>
              <h3 className="font-semibold text-slate-800 mb-1">No leads yet</h3>
              <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
                Generate AI-recommended companies based on your default thesis.{" "}
                {!showPrefs && <button onClick={() => setShowPrefs(true)} className="text-blue-600 hover:underline">Set your preferences first.</button>}
              </p>
              <Button onClick={topUp} className="bg-violet-600 hover:bg-violet-700"><Sparkles size={14} className="mr-2" />Generate {QUEUE_TARGET} Random Leads</Button>
            </div>
          )}
          {!leadsLoading && (leads.length > 0 || generating) && (
            <>
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs text-slate-400 max-w-xl">AI-recommended companies matched to your default thesis. Pursue to add to pipeline, pass to skip. <span className="text-amber-600 font-medium">Metrics are estimates — verify before progressing.</span></p>
                <Button variant="outline" size="sm" onClick={topUp} disabled={generating} className="shrink-0 ml-4 text-violet-600 border-violet-200 hover:bg-violet-50">
                  <Sparkles size={13} className={`mr-1.5 ${generating ? "animate-pulse" : ""}`} />
                  {generating ? "Finding…" : `Generate ${QUEUE_TARGET} Random Leads`}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leads.map(lead => <LeadCard key={lead.id} lead={lead} onPursue={() => processLead(lead, "pursue")} onSave={() => processLead(lead, "save")} onPass={() => processLead(lead, "pass")} onRefresh={() => refreshLead(lead)} processing={processingId === lead.id} refreshing={refreshingId === lead.id} />)}
                {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {!searching && (
        <div className="mt-8">
          <button onClick={() => setHistoryOpen(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 w-full text-left hover:text-slate-600 transition-colors">
            <History size={11} />Search history
            {history.length > 0 && <span className="text-[10px] font-normal ml-1">({history.length})</span>}
            {historyOpen ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
          </button>
          {historyOpen && (
            historyLoading ? (
              <div className="space-y-2 mb-6">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1 mb-6">No searches yet — every Hunt and Scout run will be saved here.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-6">
                {history.length > 5 && (
                  <div className="relative mb-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-blue-300 text-slate-700 placeholder:text-slate-400"
                      placeholder="Filter past searches…"
                      value={historyFilter}
                      onChange={e => setHistoryFilter(e.target.value)}
                    />
                  </div>
                )}
                {filteredHistory.length === 0 && (
                  <p className="text-sm text-slate-400 italic px-1 py-2">No past searches match "{historyFilter}".</p>
                )}
                {filteredHistory.map(session => (
                  <button key={session.id} onClick={() => loadSession(session)} className={`group flex items-center gap-3 text-left bg-white border border-slate-200 rounded-lg px-4 py-3 transition-colors ${session.type === "SCOUT" ? "hover:border-emerald-300 hover:bg-emerald-50" : "hover:border-blue-300 hover:bg-blue-50"}`}>
                    {session.type === "SCOUT" ? <Target size={11} className="text-slate-300 group-hover:text-emerald-400 shrink-0 transition-colors" /> : <Radar size={11} className="text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm text-slate-700 truncate ${session.type === "SCOUT" ? "group-hover:text-emerald-800" : "group-hover:text-blue-800"}`}>{session.query}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{session.resultCount} compan{session.resultCount === 1 ? "y" : "ies"} · {formatDate(session.createdAt)} · {session.type === "SCOUT" ? "Scout" : "Hunt"}</p>
                    </div>
                    <span onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all rounded" title="Delete"><Trash2 size={13} /></span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Company detail modal */}
      <CompanyPreviewModal
        company={previewResult as CompanyPreviewData | null}
        open={!!previewResult}
        onClose={() => setPreviewResult(null)}
        addedId={previewAdded?.id ?? null}
        addedType={previewAdded?.type ?? null}
        adding={addingId === previewResult?.name}
        onAdd={async () => { if (previewResult) await addCompany(previewResult, "pipeline"); }}
        onSave={async () => { if (previewResult) await addCompany(previewResult, "watchlist"); }}
      />
    </div>
  );
}
