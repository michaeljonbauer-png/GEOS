"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles, ThumbsUp, ThumbsDown, ExternalLink,
  RefreshCw, TrendingUp, Users, DollarSign, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface Lead {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  sector: string | null;
  subSector: string | null;
  geography: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  nrrEstimate: number | null;
  grossMargin: number | null;
  employees: number | null;
  founded: number | null;
  stage: string | null;
  source: string | null;
  recommendationRationale: string | null;
  recommendationScore: number | null;
}

const QUEUE_TARGET = 10;

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 75 ? "bg-green-100 text-green-700 border-green-200" :
    score >= 50 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score.toFixed(0)} fit
    </span>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={11} className="text-slate-400" />
      <span className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-5 animate-pulse flex flex-col gap-3">
      <div className="flex justify-between">
        <div className="h-4 bg-slate-100 rounded w-36" />
        <div className="h-4 bg-slate-100 rounded w-12" />
      </div>
      <div className="flex gap-1">
        <div className="h-3.5 bg-slate-100 rounded w-20" />
        <div className="h-3.5 bg-slate-100 rounded w-16" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-4/6" />
      </div>
      <div className="h-16 bg-violet-50 rounded-lg" />
      <div className="flex justify-between mt-1">
        <div className="h-3 bg-slate-100 rounded w-10" />
        <div className="h-3 bg-slate-100 rounded w-10" />
        <div className="h-3 bg-slate-100 rounded w-10" />
      </div>
      <div className="flex gap-2 mt-auto pt-1">
        <div className="h-8 bg-slate-100 rounded flex-1" />
        <div className="h-8 bg-slate-100 rounded flex-1" />
        <div className="h-8 bg-slate-100 rounded w-8" />
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  onPursue,
  onPass,
  processing,
}: {
  lead: Lead;
  onPursue: () => void;
  onPass: () => void;
  processing: boolean;
}) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all duration-200 ${
        processing ? "opacity-40 scale-[0.98] pointer-events-none" : "hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm">{lead.name}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {[lead.geography, lead.stage].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ScoreBadge score={lead.recommendationScore} />
      </div>

      {/* Sector tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {lead.sector && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium border border-violet-100">
            {lead.sector}
          </span>
        )}
        {lead.subSector && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">
            {lead.subSector}
          </span>
        )}
      </div>

      {/* Description */}
      {lead.description && (
        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">{lead.description}</p>
      )}

      {/* Why it fits */}
      {lead.recommendationRationale && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mb-1">
            Why it fits
          </p>
          <p className="text-xs text-violet-900 leading-relaxed">{lead.recommendationRationale}</p>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-1 py-2.5 border-y border-slate-100 mb-3">
        <MetricPill
          icon={DollarSign}
          label="ARR"
          value={lead.arrEstimate != null ? `$${lead.arrEstimate}M` : "—"}
        />
        <MetricPill
          icon={TrendingUp}
          label="Growth"
          value={lead.arrGrowth != null ? `+${lead.arrGrowth}%` : "—"}
        />
        <MetricPill
          icon={Users}
          label="Team"
          value={lead.employees != null ? String(lead.employees) : "—"}
        />
      </div>

      {/* Source */}
      {lead.source && (
        <p className="text-[10px] text-slate-400 mb-3 flex items-center gap-1">
          <AlertCircle size={9} className="shrink-0" />
          AI estimate · verify via {lead.source}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          onClick={onPursue}
        >
          <ThumbsUp size={12} className="mr-1" /> Pursue
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-red-500 hover:bg-red-50 border-red-200 text-xs"
          onClick={onPass}
        >
          <ThumbsDown size={12} className="mr-1" /> Pass
        </Button>
        <Link href={`/companies/${lead.id}`}>
          <Button size="sm" variant="outline" className="px-2.5">
            <ExternalLink size={12} />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    const res = await fetch("/api/leads");
    if (!res.ok) return [];
    return res.json();
  }, []);

  const topUp = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/leads/generate", { method: "POST" });
      if (!res.ok) throw new Error("Generation failed");
      const { generated, message } = await res.json() as { generated: number; message?: string };
      if (generated === 0 && message) {
        toast({ title: message });
      }
      const fresh = await fetchLeads();
      setLeads(fresh);
    } catch {
      toast({
        title: "Could not generate leads",
        description: "Check that ANTHROPIC_API_KEY is set in Railway environment variables.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [fetchLeads, toast]);

  // On mount: load existing leads; auto-top-up if below target
  useEffect(() => {
    fetchLeads().then(data => {
      setLeads(data);
      setInitialLoading(false);
      if (data.length < QUEUE_TARGET) topUp();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processLead = async (lead: Lead, action: "pursue" | "pass") => {
    setProcessingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();

      // Remove card immediately, then top up
      const next = leads.filter(l => l.id !== lead.id);
      setLeads(next);
      toast({
        title: action === "pursue" ? `${lead.name} added to pipeline` : `Passed on ${lead.name}`,
        description: action === "pursue"
          ? "Now visible in Companies as Identified."
          : "Feedback recorded — finding a replacement lead…",
      });
      // Always top up after processing (next.length will be 9, so 1 new lead is generated)
      topUp();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  // Number of skeleton cards to show while generating
  const skeletonCount = generating ? Math.max(0, QUEUE_TARGET - leads.length) : 0;
  const totalVisible = leads.length + skeletonCount;

  if (initialLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="text-violet-500" size={20} />
          <h1 className="text-xl font-bold text-slate-900">Leads</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: QUEUE_TARGET }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Sparkles className="text-violet-500" size={20} />
            <h1 className="text-xl font-bold text-slate-900">Leads</h1>
            <span className="text-sm text-slate-400 tabular-nums">
              {totalVisible}/{QUEUE_TARGET}
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-xl">
            AI-recommended companies matched to your thesis. Pursue to add to pipeline, pass to skip and record feedback.{" "}
            <span className="text-amber-600 font-medium">Metrics are estimates — verify before progressing.</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={topUp}
          disabled={generating}
          className="shrink-0"
        >
          <RefreshCw size={13} className={`mr-1.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Finding leads…" : "Refresh queue"}
        </Button>
      </div>

      {/* Empty state — no leads and not generating */}
      {leads.length === 0 && !generating && (
        <div className="text-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 mx-auto mb-4">
            <Sparkles className="text-violet-500" size={28} />
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No leads yet</h3>
          <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
            Generate your first batch of AI-recommended companies based on your investment thesis.
          </p>
          <Button onClick={topUp} className="bg-violet-600 hover:bg-violet-700">
            <Sparkles size={14} className="mr-2" /> Generate {QUEUE_TARGET} leads
          </Button>
        </div>
      )}

      {/* Card grid */}
      {(leads.length > 0 || generating) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onPursue={() => processLead(lead, "pursue")}
              onPass={() => processLead(lead, "pass")}
              processing={processingId === lead.id}
            />
          ))}
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={`skel-${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}
