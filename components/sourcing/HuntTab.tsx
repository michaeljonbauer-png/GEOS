"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles, ThumbsDown, ExternalLink, Radar, Send, Building2, BookmarkPlus,
  RotateCcw, ChevronDown, ChevronUp, Search, History, Trash2, Clock, ArrowRight, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow, CompanyPreviewModal, type CompanyPreviewData } from "./shared";

interface HuntResult {
  name: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  founded: number | null; stage: string | null; totalFundingM: number | null;
  employees: number | null; arrEstimate: number | null; arrGrowth: number | null;
  nrrEstimate?: number | null; grossMargin?: number | null;
  acquired?: boolean; acquiredBy?: string | null; acquisitionUncertain?: boolean;
  huntRationale: string | null; huntScore: number | null; source: string | null;
  founderName?: string | null; founderTitle?: string | null;
  founderLinkedIn?: string | null; founderEmail?: string | null;
}

interface HuntSessionMeta {
  id: string; query: string; resultCount: number; createdAt: string;
}

const EXAMPLE_QUERIES = [
  "Manufacturing software companies with 25–75 employees founded 2020–2023 that serve interesting parts of the manufacturing value chain",
  "Vertical SaaS for commercial real estate or property management, Series A stage, strong NRR",
  "Healthcare compliance or prior authorization automation, bootstrapped or seed stage, Southeast US",
  "B2B fintech for community banks or credit unions, founder-led, under $10M ARR",
  "Supply chain visibility or logistics software for mid-market manufacturers",
  "Field service management software for trades (HVAC, plumbing, electrical), founded after 2019",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3600000;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HuntCard({ result, onOpenDetail, onAdd, onSave, onDismiss, onScout, adding, dismissed, addedId, addedType }: {
  result: HuntResult;
  onOpenDetail: () => void;
  onAdd: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onScout: () => void;
  adding: boolean;
  dismissed: boolean;
  addedId: string | null;
  addedType: "pipeline" | "watchlist" | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (addedId) {
    const isPipeline = addedType === "pipeline";
    return (
      <div className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${isPipeline ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${isPipeline ? "text-emerald-800" : "text-slate-700"}`}>{result.name}</p>
          <p className={`text-xs mt-0.5 ${isPipeline ? "text-emerald-600" : "text-slate-500"}`}>
            {isPipeline ? "Added to pipeline" : "Saved to Companies"}
          </p>
        </div>
        <Link href={`/companies/${addedId}`} className={`flex items-center gap-1 text-xs font-medium shrink-0 ${isPipeline ? "text-emerald-700 hover:text-emerald-900" : "text-slate-600 hover:text-slate-900"}`}>
          View profile <ArrowRight size={12} />
        </Link>
      </div>
    );
  }
  if (dismissed) return null;

  if (result.acquired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 opacity-80">
        <Ban size={15} className="text-red-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-800 truncate">{result.name}</p>
          <p className="text-xs text-red-600 mt-0.5">
            Acquired{result.acquiredBy ? ` by ${result.acquiredBy}` : ""} — not an investable opportunity
          </p>
        </div>
        <Button size="sm" variant="ghost" className="px-1.5 text-slate-400 shrink-0" onClick={onDismiss} title="Dismiss">
          <ThumbsDown size={12} />
        </Button>
      </div>
    );
  }

  const descLong = (result.description ?? "").length > 180;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <button onClick={onOpenDetail} className="text-left w-full group" title="View full details & thesis fit">
            <h3 className="font-semibold text-blue-700 group-hover:text-blue-900 underline decoration-blue-200 underline-offset-2 group-hover:decoration-blue-500 truncate text-sm transition-colors">
              {result.name}
            </h3>
          </button>
          <p className="text-[11px] text-slate-400 mt-0.5">{[result.geography, result.stage, result.founded ? `Founded ${result.founded}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={result.huntScore} label="match" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {result.sector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">{result.sector}</span>}
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
      {result.huntRationale && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-1">Why it matches</p>
          <p className={`text-xs text-blue-900 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{result.huntRationale}</p>
        </div>
      )}
      <MetricRow arrEstimate={result.arrEstimate} arrGrowth={result.arrGrowth} employees={result.employees} />
      {result.totalFundingM != null && (
        <p className="text-[10px] text-slate-400 mb-3">Total raised: <span className="font-medium text-slate-600">${result.totalFundingM}M</span>{result.source ? ` · ${result.source}` : ""}</p>
      )}
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={onOpenDetail}>
          <Search size={12} className="mr-1" />View details & fit
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={onAdd} disabled={adding} title="Add to pipeline (active opp)">
          <Building2 size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-500 border-slate-200 hover:bg-slate-50" onClick={onSave} disabled={adding} title="Save to Companies (watchlist — not pipeline)">
          <BookmarkPlus size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={onScout} title="Research in Scout">
          <ExternalLink size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-400 hover:bg-slate-50" onClick={onDismiss} title="Dismiss">
          <ThumbsDown size={12} />
        </Button>
      </div>
    </div>
  );
}

export function HuntTab({ onScout }: { onScout?: (name: string) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HuntResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [addedCompanies, setAddedCompanies] = useState<Map<string, { id: string; type: "pipeline" | "watchlist" }>>(new Map());
  const [previewResult, setPreviewResult] = useState<HuntResult | null>(null);
  const [history, setHistory] = useState<HuntSessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [activeSessionDate, setActiveSessionDate] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/hunt");
      const data = await res.json();
      setHistory(data.sessions ?? []);
      return data.sessions as HuntSessionMeta[];
    } catch {
      return [] as HuntSessionMeta[];
    }
  };

  useEffect(() => {
    fetchHistory().then(sessions => {
      if (sessions.length > 0) loadSession(sessions[0]);
    }).finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async (session: HuntSessionMeta) => {
    try {
      const res = await fetch(`/api/hunt/${session.id}`);
      const data = await res.json();
      setQuery(session.query);
      setResults(data.results ?? []);
      setLastQuery(session.query);
      setDismissed(new Set());
      setAddedCompanies(new Map());
      setActiveSessionDate(session.createdAt);
      setHistoryOpen(false);
    } catch {
      toast({ title: "Failed to load session", variant: "destructive" });
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/hunt/${id}`, { method: "DELETE" });
      setHistory(prev => prev.filter(s => s.id !== id));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const hunt = async (q = query) => {
    if (!q.trim() || loading) return;
    setLoading(true); setResults([]); setDismissed(new Set()); setAddedCompanies(new Map()); setActiveSessionDate(null); setHistoryOpen(false);
    try {
      const res = await fetch("/api/hunt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), count: 6 }),
      });
      const data = await res.json() as { results?: HuntResult[]; error?: string; query?: string };
      if (!res.ok) { toast({ title: "Hunt failed", description: data.error ?? "Unknown error", variant: "destructive" }); return; }
      setResults(data.results ?? []);
      setLastQuery(data.query ?? q.trim());
      setActiveSessionDate(new Date().toISOString());
      if ((data.results ?? []).length === 0) toast({ title: "No results", description: "Try rephrasing or broadening the criteria." });
      fetchHistory();
    } catch (err) {
      toast({ title: "Hunt failed", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const addCompany = async (result: HuntResult, type: "pipeline" | "watchlist"): Promise<string | null> => {
    setAddingId(result.name);
    try {
      const status = type === "pipeline" ? "IDENTIFIED" : "WATCHLIST";
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, website: result.website, description: result.description, sector: result.sector, subSector: result.subSector, geography: result.geography, founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM, employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth, nrrEstimate: result.nrrEstimate, grossMargin: result.grossMargin, status, priority: "MEDIUM", source: `Hunt: ${lastQuery}`, recommendationScore: result.huntScore, recommendationRationale: result.huntRationale }),
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
      // Auto-create founder/CEO contact if available
      if (result.founderName) {
        const parts = result.founderName.trim().split(/\s+/);
        fetch("/api/contacts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: parts[0], lastName: parts.slice(1).join(" ") || "-",
            title: result.founderTitle ?? "Founder",
            linkedinUrl: result.founderLinkedIn ?? null,
            email: result.founderEmail ?? null,
            isPrimary: true, companyId: data.id,
          }),
        }).catch(() => { /* non-fatal */ });
      }
      toast({ title: type === "pipeline" ? `${result.name} added to pipeline` : `${result.name} saved to Companies` });
      return data.id;
    } catch (err) {
      toast({ title: "Failed to save company", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
      return null;
    } finally { setAddingId(null); }
  };

  const clearResults = () => {
    setResults([]); setQuery(""); setLastQuery(""); setDismissed(new Set()); setAddedCompanies(new Map()); setActiveSessionDate(null); setHistoryOpen(true);
  };

  const useExample = (ex: string) => { setQuery(ex); setTimeout(() => hunt(ex), 0); };

  const hasResults = results.length > 0;
  const visibleCount = results.filter(r => !dismissed.has(r.name) || addedCompanies.has(r.name)).length;
  const previewAdded = previewResult ? (addedCompanies.get(previewResult.name) ?? null) : null;
  const previewAddedId = previewAdded?.id ?? null;
  const previewAddedType = previewAdded?.type ?? null;

  return (
    <div>
      {/* Search box */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <textarea
          className="w-full text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none leading-relaxed"
          rows={3}
          placeholder={'Describe what you\'re looking for… e.g. "Vertical SaaS for commercial real estate, Series A, strong NRR"'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) hunt(); }}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">⌘ + Enter to run</p>
          <Button onClick={() => hunt()} disabled={loading || !query.trim()} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            {loading ? <><Radar size={13} className="mr-1.5 animate-pulse" />Hunting…</> : <><Send size={13} className="mr-1.5" />Hunt</>}
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
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

      {/* Results */}
      {hasResults && !loading && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-700">{visibleCount} result{visibleCount !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                {activeSessionDate && <><Clock size={10} />{formatDate(activeSessionDate)} · </>}
                <span className="line-clamp-1">"{lastQuery}"</span>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearResults} className="text-slate-500">
              <RotateCcw size={13} className="mr-1.5" />New search
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {results.map(result => (
              <HuntCard
                key={result.name}
                result={result}
                onOpenDetail={() => setPreviewResult(result)}
                onAdd={() => addCompany(result, "pipeline")}
                onSave={() => addCompany(result, "watchlist")}
                onDismiss={() => { const s = new Set(dismissed); s.add(result.name); setDismissed(s); }}
                onScout={() => onScout?.(result.name)}
                adding={addingId === result.name}
                dismissed={dismissed.has(result.name)}
                addedId={addedCompanies.get(result.name)?.id ?? null}
                addedType={addedCompanies.get(result.name)?.type ?? null}
              />
            ))}
          </div>
          {results.every(r => dismissed.has(r.name) && !addedCompanies.has(r.name)) && (
            <div className="text-center py-8 text-slate-400 text-sm mb-8">
              All results dismissed. <button className="text-blue-600 hover:underline" onClick={clearResults}>Start a new search</button>
            </div>
          )}
        </>
      )}

      {/* History — always visible */}
      {!loading && (
        <div>
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 w-full text-left hover:text-slate-600 transition-colors"
          >
            <History size={11} />
            Past searches
            {history.length > 0 && <span className="text-[10px] font-normal ml-1">({history.length})</span>}
            {historyOpen ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
          </button>
          {historyOpen && (
            historyLoading ? (
              <div className="space-y-2 mb-6">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1 mb-6">
                No searches yet — every Hunt query you run will be saved here so you can revisit the results anytime.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-6">
                {history.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className="group flex items-center gap-3 text-left bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate group-hover:text-blue-800">{session.query}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{session.resultCount} compan{session.resultCount === 1 ? "y" : "ies"} · {formatDate(session.createdAt)}</p>
                    </div>
                    <span onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all rounded" title="Delete">
                      <Trash2 size={13} />
                    </span>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Example queries — only in empty state */}
          {!hasResults && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Sparkles size={11} />Example queries
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_QUERIES.map((ex, i) => (
                  <button key={i} onClick={() => useExample(ex)} className="text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2.5 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Company detail modal — full thesis fit scorecard, no pipeline add required */}
      <CompanyPreviewModal
        company={previewResult as CompanyPreviewData | null}
        open={!!previewResult}
        onClose={() => setPreviewResult(null)}
        addedId={previewAddedId}
        addedType={previewAddedType}
        adding={addingId === previewResult?.name}
        onAdd={async () => { if (previewResult) await addCompany(previewResult, "pipeline"); }}
        onSave={async () => { if (previewResult) await addCompany(previewResult, "watchlist"); }}
      />
    </div>
  );
}
