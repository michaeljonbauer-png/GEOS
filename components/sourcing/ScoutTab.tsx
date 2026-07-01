"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, ThumbsDown, Building2, BookmarkPlus, RotateCcw, Target, Loader2, Search, ArrowRight, History, Trash2, ChevronDown, ChevronUp, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow, CompanyPreviewModal, type CompanyPreviewData } from "./shared";

interface ScoutResult {
  name: string; inputName: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  founded: number | null; stage: string | null; totalFundingM: number | null;
  employees: number | null; arrEstimate: number | null; arrGrowth: number | null;
  nrrEstimate?: number | null; grossMargin?: number | null;
  acquired?: boolean; acquiredBy?: string | null;
  fitScore: number | null; fitRationale: string | null; source: string | null;
  founderName?: string | null; founderTitle?: string | null;
  founderLinkedIn?: string | null; founderEmail?: string | null;
  error?: string;
}

interface SessionMeta { id: string; query: string; resultCount: number; createdAt: string; }

const EMPTY: Omit<ScoutResult, "name" | "inputName"> = {
  website: null, description: null, sector: null, subSector: null, geography: null,
  founded: null, stage: null, totalFundingM: null, employees: null,
  arrEstimate: null, arrGrowth: null, fitScore: null, fitRationale: null, source: null,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3600000;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ScoutCard({ result, onOpenDetail, onAdd, onSave, onDismiss, adding, dismissed, addedId, addedType }: {
  result: ScoutResult;
  onOpenDetail: () => void;
  onAdd: () => void;
  onSave: () => void;
  onDismiss: () => void;
  adding: boolean;
  dismissed: boolean;
  addedId: string | null;
  addedType: "pipeline" | "watchlist" | null;
}) {
  if (dismissed && !addedId) return null;

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

  if (result.error) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-slate-400" />
          <h3 className="font-medium text-slate-500 text-sm">{result.inputName}</h3>
        </div>
        <p className="text-xs text-slate-400">{result.error}</p>
      </div>
    );
  }

  if (result.acquired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col opacity-80">
        <div className="flex items-start gap-2 mb-2">
          <Ban size={15} className="text-red-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-red-800 truncate text-sm">{result.name}</h3>
            <p className="text-xs text-red-600 mt-0.5">
              Acquired{result.acquiredBy ? ` by ${result.acquiredBy}` : ""} — not an investable opportunity
            </p>
          </div>
        </div>
        {result.description && <p className="text-xs text-red-700/70 leading-relaxed mb-3 line-clamp-2">{result.description}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="px-2.5 text-slate-400 hover:bg-slate-50" onClick={onDismiss} title="Dismiss">
            <ThumbsDown size={12} />
          </Button>
          {result.website && (
            <a href={result.website} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="px-2.5"><ExternalLink size={12} /></Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <button onClick={onOpenDetail} className="text-left w-full group" title="View full details & thesis fit">
            <h3 className="font-semibold text-emerald-700 group-hover:text-emerald-900 underline decoration-emerald-200 underline-offset-2 group-hover:decoration-emerald-500 truncate text-sm transition-colors">
              {result.name}
            </h3>
          </button>
          <p className="text-[11px] text-slate-400 mt-0.5">{[result.geography, result.stage, result.founded ? `Founded ${result.founded}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <ScoreBadge score={result.fitScore} />
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {result.sector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">{result.sector}</span>}
        {result.subSector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">{result.subSector}</span>}
      </div>
      {result.description && <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">{result.description}</p>}
      {result.fitRationale && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">Thesis fit</p>
          <p className="text-xs text-emerald-900 leading-relaxed line-clamp-2">{result.fitRationale}</p>
        </div>
      )}
      <MetricRow arrEstimate={result.arrEstimate} arrGrowth={result.arrGrowth} employees={result.employees} />
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={onOpenDetail}>
          <Search size={12} className="mr-1" />View details & fit
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={onAdd} disabled={adding} title="Add to pipeline (active opp)">
          <Building2 size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-500 border-slate-200 hover:bg-slate-50" onClick={onSave} disabled={adding} title="Save to Companies (watchlist — not pipeline)">
          <BookmarkPlus size={12} />
        </Button>
        <Button size="sm" variant="outline" className="px-2.5 text-slate-400 hover:bg-slate-50" onClick={onDismiss} title="Dismiss">
          <ThumbsDown size={12} />
        </Button>
        {result.website && (
          <a href={result.website} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="px-2.5"><ExternalLink size={12} /></Button>
          </a>
        )}
      </div>
    </div>
  );
}

export function ScoutTab({ prefill }: { prefill?: string }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  useEffect(() => { if (prefill) setInput(prefill); }, [prefill]);

  const [results, setResults] = useState<ScoutResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [scouting, setScouting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedCompanies, setAddedCompanies] = useState<Map<string, { id: string; type: "pipeline" | "watchlist" }>>(new Map());
  const [previewResult, setPreviewResult] = useState<ScoutResult | null>(null);

  // History
  const [history, setHistory] = useState<SessionMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const hasResults = results.length > 0;
  const companies = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/scout/sessions");
      const data = await res.json();
      setHistory(data.sessions ?? []);
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  const loadSession = async (session: SessionMeta) => {
    try {
      const res = await fetch(`/api/hunt/${session.id}`);
      const data = await res.json();
      const sessionResults: ScoutResult[] = (data.results ?? []).map((r: Omit<ScoutResult, "inputName">) => ({ ...r, inputName: r.name }));
      setResults(sessionResults);
      setLastQuery(session.query);
      setInput(session.query);
      setDismissed(new Set());
      setAddedCompanies(new Map());
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
    } catch { /* ignore */ }
  };

  const scout = async () => {
    if (!companies.length || scouting) return;
    const batch = companies.slice(0, 20);
    const query = batch.join(", ");
    setScouting(true); setResults([]); setDismissed(new Set()); setAddedCompanies(new Map()); setHistoryOpen(false);
    const newResults: ScoutResult[] = [];
    for (let i = 0; i < batch.length; i++) {
      const name = batch[i];
      setProgress({ current: i + 1, total: batch.length, name });
      try {
        const res = await fetch("/api/scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: name }) });
        const data = await res.json();
        const r: ScoutResult = res.ok && data.result ? { ...data.result, inputName: name } : { ...EMPTY, name, inputName: name, error: data.error ?? "Could not research this company" };
        newResults.push(r);
        setResults(prev => [...prev, r]);
      } catch (err) {
        const r: ScoutResult = { ...EMPTY, name, inputName: name, error: err instanceof Error ? err.message : "Network error" };
        newResults.push(r);
        setResults(prev => [...prev, r]);
      }
    }
    setScouting(false); setProgress(null); setLastQuery(query);
    // Save session
    const successful = newResults.filter(r => !r.error);
    if (successful.length > 0) {
      fetch("/api/scout/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, results: successful }),
      }).then(() => fetchHistory()).catch(() => { /* non-fatal */ });
    }
  };

  const addCompany = async (result: ScoutResult, type: "pipeline" | "watchlist"): Promise<string | null> => {
    setAddingId(result.name);
    try {
      const status = type === "pipeline" ? "IDENTIFIED" : "WATCHLIST";
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name, website: result.website, description: result.description,
          sector: result.sector, subSector: result.subSector, geography: result.geography,
          founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM,
          employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth,
          nrrEstimate: result.nrrEstimate, grossMargin: result.grossMargin,
          status, priority: "MEDIUM",
          source: result.source ?? "Scout: web-verified",
          recommendationScore: result.fitScore,
          recommendationRationale: result.fitRationale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const search = await fetch(`/api/companies?search=${encodeURIComponent(result.name)}`);
        if (search.ok) {
          const existing: Array<{ id: string; name: string }> = await search.json();
          const match = existing.find(c => c.name.toLowerCase() === result.name.toLowerCase());
          if (match) {
            const m = new Map(addedCompanies); m.set(result.name, { id: match.id, type }); setAddedCompanies(m);
            return match.id;
          }
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
          rows={4}
          placeholder={"Enter company names or URLs, one per line:\n\nAcme Corp\nhttps://widgetco.com\nFoo Industries"}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">{companies.length > 0 ? `${companies.length} compan${companies.length === 1 ? "y" : "ies"} · up to 20 per run` : "Names or URLs · one per line · up to 20"}</p>
          <Button onClick={scout} disabled={scouting || !companies.length} className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
            {scouting ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Scouting…</> : <><Target size={13} className="mr-1.5" />Scout</>}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-3 mb-6 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <Loader2 size={14} className="text-emerald-500 animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-800">Researching {progress.current} of {progress.total}: {progress.name}</p>
            <div className="mt-1.5 h-1 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && !scouting && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-700">
              {visibleCount} result{visibleCount !== 1 ? "s" : ""}
              {lastQuery && <span className="text-slate-400 font-normal ml-2 text-xs">for "{lastQuery}"</span>}
              {results.some(r => r.error) && <span className="text-slate-400 font-normal ml-1">· {results.filter(r => r.error).length} not found</span>}
            </p>
            <Button variant="outline" size="sm" onClick={() => { setResults([]); setInput(""); setDismissed(new Set()); setHistoryOpen(true); }} className="text-slate-500">
              <RotateCcw size={13} className="mr-1.5" />Clear
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {results.map((result, i) => (
              <ScoutCard
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
        </>
      )}

      {/* History — always visible */}
      {!scouting && (
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
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1 mb-6">
                No searches yet — every Scout run will be saved here so you can revisit results anytime.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-6">
                {history.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className="group flex items-center gap-3 text-left bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                  >
                    <Search size={11} className="text-slate-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate group-hover:text-emerald-800">{session.query}</p>
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
        </div>
      )}

      {/* Empty state */}
      {!scouting && !hasResults && (
        <div className="text-center py-12 text-slate-400">
          <Target size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 mb-1">Research specific companies</p>
          <p className="text-xs max-w-sm mx-auto">Paste names from award lists, referrals, or your own research. Scout looks them up and scores each against your thesis.</p>
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
