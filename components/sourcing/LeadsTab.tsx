"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Sparkles, ThumbsUp, ThumbsDown, ExternalLink, RefreshCw,
  AlertCircle, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge, MetricRow } from "./shared";

interface Lead {
  id: string; name: string; website: string | null; description: string | null;
  sector: string | null; subSector: string | null; geography: string | null;
  arrEstimate: number | null; arrGrowth: number | null; employees: number | null;
  stage: string | null; source: string | null;
  recommendationRationale: string | null; recommendationScore: number | null;
  scoreBreakdown: string | null;
}

interface ScoreCriterion { criterion: string; met: boolean; score: number; note: string; }

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

function LeadCard({ lead, onPursue, onPass, onRefresh, processing, refreshing }: {
  lead: Lead; onPursue: () => void; onPass: () => void; onRefresh: () => void;
  processing: boolean; refreshing: boolean;
}) {
  return (
    <div className={`relative bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${processing ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"} ${refreshing ? "ring-2 ring-violet-300 ring-offset-1" : ""}`}>
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
      <div className="flex flex-col gap-2 mt-auto">
        <button onClick={onRefresh} disabled={refreshing} className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-md py-1 transition-colors disabled:opacity-50">
          <Search size={10} className={refreshing ? "animate-pulse" : ""} />
          {refreshing ? "Verifying with live web data…" : "Refresh with live web data"}
        </button>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={onPursue}><ThumbsUp size={12} className="mr-1" />Pursue</Button>
          <Button size="sm" variant="outline" className="flex-1 text-red-500 hover:bg-red-50 border-red-200 text-xs" onClick={onPass}><ThumbsDown size={12} className="mr-1" />Pass</Button>
          <Link href={`/companies/${lead.id}`}><Button size="sm" variant="outline" className="px-2.5"><ExternalLink size={12} /></Button></Link>
        </div>
      </div>
    </div>
  );
}

const QUEUE_TARGET = 9;

export function LeadsTab() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const generatingRef = useRef(false);

  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    const res = await fetch("/api/leads");
    if (!res.ok) return [];
    return res.json();
  }, []);

  const topUp = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const res = await fetch("/api/leads/generate", { method: "POST" });
      const data = await res.json() as { generated?: number; message?: string; error?: string };
      if (!res.ok) { toast({ title: "Could not generate leads", description: data.error ?? "Unknown error", variant: "destructive" }); return; }
      if (data.generated === 0 && data.message) toast({ title: data.message });
      setLeads(await fetchLeads());
    } catch (err) {
      toast({ title: "Could not generate leads", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
    } finally { setGenerating(false); generatingRef.current = false; }
  }, [fetchLeads, toast]);

  useEffect(() => {
    fetchLeads().then(data => { setLeads(data); setInitialLoading(false); if (data.length < QUEUE_TARGET) topUp(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshLead = async (lead: Lead) => {
    setRefreshingId(lead.id);
    try {
      const res = await fetch(`/api/companies/${lead.id}/refresh`, { method: "POST" });
      const data = await res.json() as { company?: Lead; changed?: string[]; notes?: string; error?: string };
      if (!res.ok) { toast({ title: "Refresh failed", description: data.error ?? "Unknown error", variant: "destructive" }); return; }
      if (data.company) setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...data.company! } : l));
      const n = data.changed?.length ?? 0;
      toast({ title: n > 0 ? `Updated ${lead.name}` : `No changes for ${lead.name}`, description: data.notes ?? (n > 0 ? `Refreshed ${n} fields.` : "Existing data appears current.") });
    } catch (err) {
      toast({ title: "Refresh failed", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
    } finally { setRefreshingId(null); }
  };

  const processLead = async (lead: Lead, action: "pursue" | "pass") => {
    setProcessingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) throw new Error();
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      toast({ title: action === "pursue" ? `${lead.name} added to pipeline` : `Passed on ${lead.name}`, description: action === "pursue" ? "Now visible in Companies as Identified." : "Feedback recorded — finding a replacement…" });
      topUp();
    } catch { toast({ title: "Action failed", variant: "destructive" }); }
    finally { setProcessingId(null); }
  };

  const skeletonCount = generating ? Math.max(0, QUEUE_TARGET - leads.length) : 0;

  if (initialLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: QUEUE_TARGET }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs text-slate-400 max-w-xl">
          AI-recommended companies matched to your thesis. Pursue to add to pipeline, pass to skip.{" "}
          <span className="text-amber-600 font-medium">Metrics are estimates — verify before progressing.</span>
        </p>
        <Button variant="outline" size="sm" onClick={topUp} disabled={generating} className="shrink-0 ml-4">
          <RefreshCw size={13} className={`mr-1.5 ${generating ? "animate-spin" : ""}`} />{generating ? "Finding…" : "Refresh queue"}
        </Button>
      </div>
      {leads.length === 0 && !generating && (
        <div className="text-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 mx-auto mb-4"><Sparkles className="text-violet-500" size={28} /></div>
          <h3 className="font-semibold text-slate-800 mb-1">No leads yet</h3>
          <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">Generate your first batch of AI-recommended companies based on your investment thesis.</p>
          <Button onClick={topUp} className="bg-violet-600 hover:bg-violet-700"><Sparkles size={14} className="mr-2" />Generate {QUEUE_TARGET} leads</Button>
        </div>
      )}
      {(leads.length > 0 || generating) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onPursue={() => processLead(lead, "pursue")} onPass={() => processLead(lead, "pass")} onRefresh={() => refreshLead(lead)} processing={processingId === lead.id} refreshing={refreshingId === lead.id} />
          ))}
          {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
        </div>
      )}
    </div>
  );
}
