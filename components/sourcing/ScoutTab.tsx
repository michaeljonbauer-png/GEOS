"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, ThumbsDown, Building2, RotateCcw, Target, Loader2, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow } from "./shared";

interface ScoutResult {
  name: string; inputName: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  founded: number | null; stage: string | null; totalFundingM: number | null;
  employees: number | null; arrEstimate: number | null; arrGrowth: number | null;
  fitScore: number | null; fitRationale: string | null; source: string | null;
  error?: string;
}

const EMPTY: Omit<ScoutResult, "name" | "inputName"> = {
  website: null, description: null, sector: null, subSector: null, geography: null,
  founded: null, stage: null, totalFundingM: null, employees: null,
  arrEstimate: null, arrGrowth: null, fitScore: null, fitRationale: null, source: null,
};

function ScoutCard({ result, onAdd, onDismiss, adding, dismissed, addedId }: {
  result: ScoutResult; onAdd: () => void; onDismiss: () => void; adding: boolean; dismissed: boolean; addedId: string | null;
}) {
  if (addedId) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800 truncate">{result.name}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Added to pipeline</p>
        </div>
        <Link href={`/companies/${addedId}`}>
          <Button size="sm" variant="outline" className="shrink-0 text-emerald-700 border-emerald-300 hover:bg-emerald-100 text-xs gap-1">
            View details <ArrowRight size={11} />
          </Button>
        </Link>
      </div>
    );
  }
  if (dismissed) return null;
  if (result.error) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-2"><AlertCircle size={14} className="text-slate-400" /><h3 className="font-medium text-slate-500 text-sm">{result.inputName}</h3></div>
        <p className="text-xs text-slate-400">{result.error}</p>
      </div>
    );
  }
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${adding ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm">{result.name}</h3>
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
          <p className="text-xs text-emerald-900 leading-relaxed">{result.fitRationale}</p>
        </div>
      )}
      <MetricRow arrEstimate={result.arrEstimate} arrGrowth={result.arrGrowth} employees={result.employees} />
      {result.totalFundingM != null && <p className="text-[10px] text-slate-400 mb-3">Total raised: <span className="font-medium text-slate-600">${result.totalFundingM}M</span></p>}
      {result.source && <p className="text-[10px] text-emerald-600 font-medium mb-3 flex items-center gap-1"><Search size={9} className="shrink-0" />{result.source}</p>}
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={onAdd} disabled={adding}>
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

export function ScoutTab({ prefill }: { prefill?: string }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [scouting, setScouting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedCompanies, setAddedCompanies] = useState<Map<string, string>>(new Map());

  const companies = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const scout = async () => {
    if (!companies.length || scouting) return;
    const batch = companies.slice(0, 20);
    setScouting(true); setResults([]); setDismissed(new Set());
    for (let i = 0; i < batch.length; i++) {
      const name = batch[i];
      setProgress({ current: i + 1, total: batch.length, name });
      try {
        const res = await fetch("/api/scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: name }) });
        const data = await res.json();
        setResults(prev => [...prev, res.ok && data.result ? { ...data.result, inputName: name } : { ...EMPTY, name, inputName: name, error: data.error ?? "Could not research this company" }]);
      } catch (err) {
        setResults(prev => [...prev, { ...EMPTY, name, inputName: name, error: err instanceof Error ? err.message : "Network error" }]);
      }
    }
    setScouting(false); setProgress(null);
  };

  const addToPipeline = async (result: ScoutResult) => {
    setAddingId(result.name);
    try {
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, website: result.website, description: result.description, sector: result.sector, subSector: result.subSector, geography: result.geography, founded: result.founded, stage: result.stage, totalFundingM: result.totalFundingM, employees: result.employees, arrEstimate: result.arrEstimate, arrGrowth: result.arrGrowth, status: "IDENTIFIED", priority: "MEDIUM", source: result.source ?? "Scout: web-verified" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");
      const s = new Set(dismissed); s.add(result.name); setDismissed(s);
      const m = new Map(addedCompanies); m.set(result.name, data.id); setAddedCompanies(m);
      toast({ title: `${result.name} added to pipeline` });
    } catch (err) {
      toast({ title: "Failed to add company", description: err instanceof Error ? err.message : "Network error — company was not saved.", variant: "destructive" });
    }
    finally { setAddingId(null); }
  };

  const visibleCount = results.filter(r => !dismissed.has(r.name)).length;

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <textarea
          className="w-full text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none leading-relaxed"
          rows={5}
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

      {results.length > 0 && (
        <>
          {!scouting && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-slate-700">{visibleCount} result{visibleCount !== 1 ? "s" : ""}{results.some(r => r.error) ? ` · ${results.filter(r => r.error).length} not found` : ""}</p>
              <Button variant="outline" size="sm" onClick={() => { setResults([]); setInput(""); setDismissed(new Set()); }} className="text-slate-500"><RotateCcw size={13} className="mr-1.5" />Clear</Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result, i) => (
              <ScoutCard key={`${result.name}-${i}`} result={result} onAdd={() => addToPipeline(result)} onDismiss={() => { const s = new Set(dismissed); s.add(result.name); setDismissed(s); }} adding={addingId === result.name} dismissed={dismissed.has(result.name)} addedId={addedCompanies.get(result.name) ?? null} />
            ))}
          </div>
        </>
      )}

      {!scouting && results.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Target size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 mb-1">Research specific companies</p>
          <p className="text-xs max-w-sm mx-auto">Paste names from award lists, referrals, or your own research. Scout looks them up and scores each against your thesis.</p>
        </div>
      )}
    </div>
  );
}
