"use client";

import { useState } from "react";
import { Sparkles, ThumbsDown, ExternalLink, Radar, Send, Building2, RotateCcw } from "lucide-react";
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

const EXAMPLE_QUERIES = [
  "Manufacturing software companies with 25–75 employees founded 2020–2023 that serve interesting parts of the manufacturing value chain",
  "Vertical SaaS for commercial real estate or property management, Series A stage, strong NRR",
  "Healthcare compliance or prior authorization automation, bootstrapped or seed stage, Southeast US",
  "B2B fintech for community banks or credit unions, founder-led, under $10M ARR",
  "Supply chain visibility or logistics software for mid-market manufacturers",
  "Field service management software for trades (HVAC, plumbing, electrical), founded after 2019",
];

function HuntCard({ result, onAdd, onDismiss, adding, dismissed }: {
  result: HuntResult; onAdd: () => void; onDismiss: () => void; adding: boolean; dismissed: boolean;
}) {
  if (dismissed) return null;
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"}`}>
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
      {result.description && <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">{result.description}</p>}
      {result.huntRationale && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-1">Why it matches</p>
          <p className="text-xs text-blue-900 leading-relaxed">{result.huntRationale}</p>
        </div>
      )}
      <MetricRow arrEstimate={result.arrEstimate} arrGrowth={result.arrGrowth} employees={result.employees} />
      {result.totalFundingM != null && (
        <p className="text-[10px] text-slate-400 mb-3">Total raised: <span className="font-medium text-slate-600">${result.totalFundingM}M</span>{result.source ? ` · ${result.source}` : ""}</p>
      )}
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={onAdd} disabled={adding}>
          <Building2 size={12} className="mr-1" />{adding ? "Adding…" : "Add to pipeline"}
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-slate-400 hover:bg-slate-50 text-xs" onClick={onDismiss}>
          <ThumbsDown size={12} className="mr-1" />Dismiss
        </Button>
        {result.website && <a href={result.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="px-2.5"><ExternalLink size={12} /></Button></a>}
      </div>
    </div>
  );
}

export function HuntTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HuntResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const hunt = async (q = query) => {
    if (!q.trim() || loading) return;
    setLoading(true); setResults([]); setDismissed(new Set());
    try {
      const res = await fetch("/api/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q.trim(), count: 6 }) });
      const data = await res.json() as { results?: HuntResult[]; error?: string; query?: string };
      if (!res.ok) { toast({ title: "Hunt failed", description: data.error ?? "Unknown error", variant: "destructive" }); return; }
      setResults(data.results ?? []);
      setLastQuery(data.query ?? q.trim());
      if ((data.results ?? []).length === 0) toast({ title: "No results", description: "Try rephrasing or broadening the criteria." });
    } catch (err) {
      toast({ title: "Hunt failed", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const addToPipeline = async (result: HuntResult) => {
    setAddingId(result.name);
    try {
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, website: result.website, description: result.description, sector: result.sector, subSector: result.subSector, geography: result.geography, founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM, employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth, status: "IDENTIFIED", priority: "MEDIUM", source: `Hunt: ${lastQuery}` }),
      });
      if (!res.ok) throw new Error();
      const s = new Set(dismissed); s.add(result.name); setDismissed(s);
      toast({ title: `${result.name} added to pipeline`, description: "Now visible in Companies as Identified." });
    } catch { toast({ title: "Failed to add company", variant: "destructive" }); }
    finally { setAddingId(null); }
  };

  const useExample = (ex: string) => { setQuery(ex); setTimeout(() => hunt(ex), 0); };

  return (
    <div>
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

      {results.length === 0 && !loading && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Example queries</p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_QUERIES.map((ex, i) => (
              <button key={i} onClick={() => useExample(ex)} className="text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2.5 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                <Sparkles size={11} className="inline mr-1.5 text-blue-400" />{ex}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {results.length > 0 && !loading && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-700">{results.filter(r => !dismissed.has(r.name)).length} results</p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">"{lastQuery}"</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setResults([]); setQuery(""); }} className="text-slate-500">
              <RotateCcw size={13} className="mr-1.5" />New search
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(result => (
              <HuntCard key={result.name} result={result} onAdd={() => addToPipeline(result)} onDismiss={() => { const s = new Set(dismissed); s.add(result.name); setDismissed(s); }} adding={addingId === result.name} dismissed={dismissed.has(result.name)} />
            ))}
          </div>
          {results.every(r => dismissed.has(r.name)) && (
            <div className="text-center py-16 text-slate-400 text-sm">
              All results dismissed.{" "}
              <button className="text-blue-600 hover:underline" onClick={() => { setResults([]); setQuery(""); }}>Start a new search</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
