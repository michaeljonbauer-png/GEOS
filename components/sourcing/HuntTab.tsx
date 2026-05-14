"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ThumbsDown, ExternalLink, Radar, Send, Building2,
  RotateCcw, ChevronDown, ChevronUp, Search, History, Trash2, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow } from "./shared";

interface HuntResult {
  name: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  founded: number | null; stage: string | null; totalFundingM: number | null;
  employees: number | null; arrEstimate: number | null; arrGrowth: number | null;
  huntRationale: string | null; huntScore: number | null; source: string | null;
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
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HuntCard({ result, onAdd, onDismiss, onScout, adding, dismissed, addedId }: {
  result: HuntResult; onAdd: () => Promise<string | null>; onDismiss: () => void;
  onScout: () => void; adding: boolean; dismissed: boolean; addedId: string | null;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = async () => {
    if (adding) return;
    if (addedId) { router.push(`/companies/${addedId}`); return; }
    const id = await onAdd();
    if (id) router.push(`/companies/${id}`);
  };

  if (addedId) {
    return (
      <div
        onClick={() => router.push(`/companies/${addedId}`)}
        className="cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-emerald-300 hover:shadow-sm transition-all"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800 truncate">{result.name}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Added · click to view full profile</p>
        </div>
        <ArrowRight size={14} className="text-emerald-600 shrink-0" />
      </div>
    );
  }
  if (dismissed) return null;
  const descLong = (result.description ?? "").length > 180;

  return (
    <div
      onClick={handleCardClick}
      className={`cursor-pointer bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-blue-300 hover:shadow-sm"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm">{result.name}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{[result.geography, result.stage, result.founded ? `Founded ${result.founded}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <ScoreBadge score={result.huntScore} label="match" />
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {result.sector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">{result.sector}</span>}
        {result.subSector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">{result.subSector}</span>}
      </div>
      {result.description && (
        <div className="mb-3" onClick={e => e.stopPropagation()}>
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
      <p className="text-[10px] text-slate-400 italic mb-3">Click card to add to pipeline &amp; open full profile</p>
      <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
        <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => onAdd()} disabled={adding}>
          <Building2 size={12} className="mr-1" />{adding ? "Adding…" : "Add to pipeline"}
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={onScout} title="Research in Scout">
          <Search size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-400 hover:bg-slate-50" onClick={onDismiss} title="Dismiss">
          <ThumbsDown size={12} />
        </Button>
        {result.website && <a href={result.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="px-2.5" title="Open website"><ExternalLink size={12} /></Button></a>}
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
  const [addedCompanies, setAddedCompanies] = useState<Map<string, string>>(new Map());
  const [history, setHistory] = useState<HuntSessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeSessionDate, setActiveSessionDate] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/hunt");
      const data = await res.json();
      setHistory(data.sessions ?? []);
      return data.sessions as HuntSessionMeta[];
    } catch {
      return [];
    }
  };

  // On mount: load history and auto-restore the most recent session
  useEffect(() => {
    fetchHistory().then(sessions => {
      if (sessions.length > 0) {
        loadSession(sessions[0]);
      }
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
      setActiveSessionDate(session.createdAt);
    } catch {
      toast({ title: "Failed to load session", variant: "destructive" });
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/hunt/${id}`, { method: "DELETE" });
      const updated = history.filter(s => s.id !== id);
      setHistory(updated);
      // If we just deleted the active session, clear results
      if (results.length > 0 && lastQuery === history.find(s => s.id === id)?.query) {
        setResults([]); setQuery(""); setLastQuery(""); setActiveSessionDate(null);
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const hunt = async (q = query) => {
    if (!q.trim() || loading) return;
    setLoading(true); setResults([]); setDismissed(new Set()); setAddedCompanies(new Map()); setActiveSessionDate(null);
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
      // Refresh history list to include this new session
      fetchHistory();
    } catch (err) {
      toast({ title: "Hunt failed", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const addToPipeline = async (result: HuntResult): Promise<string | null> => {
    setAddingId(result.name);
    try {
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, website: result.website, description: result.description, sector: result.sector, subSector: result.subSector, geography: result.geography, founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM, employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth, status: "IDENTIFIED", priority: "MEDIUM", source: `Hunt: ${lastQuery}`, recommendationScore: result.huntScore, recommendationRationale: result.huntRationale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");
      const s = new Set(dismissed); s.add(result.name); setDismissed(s);
      const m = new Map(addedCompanies); m.set(result.name, data.id); setAddedCompanies(m);
      toast({ title: `${result.name} added to pipeline` });
      return data.id;
    } catch (err) {
      toast({ title: "Failed to add company", description: err instanceof Error ? err.message : "Network error — company was not saved.", variant: "destructive" });
      return null;
    } finally { setAddingId(null); }
  };

  const clearResults = () => {
    setResults([]); setQuery(""); setLastQuery(""); setDismissed(new Set()); setAddedCompanies(new Map()); setActiveSessionDate(null);
  };

  const useExample = (ex: string) => { setQuery(ex); setTimeout(() => hunt(ex), 0); };

  const hasResults = results.length > 0;
  const visibleCount = results.filter(r => !dismissed.has(r.name)).length;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(result => (
              <HuntCard
                key={result.name}
                result={result}
                onAdd={() => addToPipeline(result)}
                onDismiss={() => { const s = new Set(dismissed); s.add(result.name); setDismissed(s); }}
                onScout={() => onScout?.(result.name)}
                adding={addingId === result.name}
                dismissed={dismissed.has(result.name)}
                addedId={addedCompanies.get(result.name) ?? null}
              />
            ))}
          </div>
          {results.every(r => dismissed.has(r.name)) && (
            <div className="text-center py-16 text-slate-400 text-sm">
              All results dismissed.{" "}
              <button className="text-blue-600 hover:underline" onClick={clearResults}>Start a new search</button>
            </div>
          )}
        </>
      )}

      {/* Empty state: history + examples */}
      {!hasResults && !loading && (
        <div>
          {/* Past searches — always shown (loading skeleton or results or empty notice) */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <History size={11} />Past searches
            </p>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">
                No searches yet — every Hunt query you run will be saved here so you can revisit the results anytime.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
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
                    <span
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all rounded"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Example queries */}
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
        </div>
      )}
    </div>
  );
}
