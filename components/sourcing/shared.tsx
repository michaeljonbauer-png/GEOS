"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Users, DollarSign, ExternalLink, Building2, ArrowRight,
  ShieldCheck, CheckCircle2, XCircle, HelpCircle, Zap, Loader2, Sparkles, Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ThesisFitResult } from "@/lib/thesis";

export function ScoreBadge({ score, label = "fit" }: { score: number | null; label?: string }) {
  if (score == null) return null;
  const color =
    score >= 75 ? "bg-green-100 text-green-700 border-green-200" :
    score >= 50 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score.toFixed(0)} {label}
    </span>
  );
}

export function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={11} className="text-slate-400" />
      <span className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export function MetricRow({ arrEstimate, arrGrowth, employees }: {
  arrEstimate: number | null; arrGrowth: number | null; employees: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 py-2.5 border-y border-slate-100 mb-3">
      <MetricPill icon={DollarSign} label="ARR" value={arrEstimate != null ? `$${arrEstimate}M` : "—"} />
      <MetricPill icon={TrendingUp} label="Growth" value={arrGrowth != null ? `+${arrGrowth}%` : "—"} />
      <MetricPill icon={Users} label="Team" value={employees != null ? String(employees) : "—"} />
    </div>
  );
}

export interface CompanyPreviewData {
  name: string;
  website?: string | null;
  description?: string | null;
  sector?: string | null;
  subSector?: string | null;
  geography?: string | null;
  founded?: number | null;
  stage?: string | null;
  totalFundingM?: number | null;
  employees?: number | null;
  arrEstimate?: number | null;
  arrGrowth?: number | null;
  nrrEstimate?: number | null;
  grossMargin?: number | null;
  fitScore?: number | null;
  fitRationale?: string | null;
  huntScore?: number | null;
  huntRationale?: string | null;
  source?: string | null;
}

const IMPORTANCE_LABEL: Record<number, string> = { 1: "Low", 2: "Low", 3: "Med", 4: "High", 5: "Critical" };

// Live thesis fit scorecard — computed from raw company data via /api/thesis-fit,
// no DB record required.
function ThesisFitScorecard({ company }: { company: CompanyPreviewData }) {
  const [fit, setFit] = useState<ThesisFitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setFit(null);
    fetch("/api/thesis-fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        founded: company.founded ?? null,
        employees: company.employees ?? null,
        totalFundingM: company.totalFundingM ?? null,
        arrEstimate: company.arrEstimate ?? null,
        arrGrowth: company.arrGrowth ?? null,
        nrrEstimate: company.nrrEstimate ?? null,
        grossMargin: company.grossMargin ?? null,
      }),
    })
      .then(r => r.json())
      .then(d => { if (cancelled) return; if (d.error) setError(d.error); else setFit(d); })
      .catch(() => { if (!cancelled) setError("Could not compute thesis fit"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [company]);

  if (loading) return (
    <div className="text-xs text-slate-400 py-3 text-center flex items-center justify-center gap-1.5">
      <Loader2 size={12} className="animate-spin" />Computing thesis fit…
    </div>
  );
  if (error) return <div className="text-xs text-red-400 py-2">{error}</div>;
  if (!fit) return null;
  if (fit.signals.length === 0 && fit.failedFilters.length === 0) {
    return <p className="text-xs text-slate-400 py-2">No thesis criteria configured yet — set them up in Settings to see a fit breakdown.</p>;
  }

  const hardFilters = fit.signals.filter(s => s.category === "HARD_FILTER");
  const signals = fit.signals.filter(s => s.category === "SIGNAL");
  const scoreColor =
    !fit.hardFilterPass ? "text-red-600" :
    fit.score === null ? "text-slate-400" :
    fit.score >= 75 ? "text-emerald-600" :
    fit.score >= 50 ? "text-yellow-600" : "text-red-500";
  const barColor =
    !fit.hardFilterPass ? "bg-red-500" :
    fit.score === null ? "bg-slate-200" :
    fit.score >= 75 ? "bg-emerald-500" :
    fit.score >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-3">
      {/* Score summary */}
      <div className="flex items-center gap-3">
        <div className="text-center shrink-0 w-16">
          {fit.hardFilterPass ? (
            <span className={`text-3xl font-black ${scoreColor}`}>{fit.score !== null ? `${fit.score}%` : "—"}</span>
          ) : (
            <span className="text-xl font-black text-red-600">Fails</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {fit.hardFilterPass && fit.score !== null && (
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fit.score}%` }} />
            </div>
          )}
          {!fit.hardFilterPass ? (
            <div className="space-y-1">
              {fit.failedFilters.map(f => (
                <div key={f.id} className="flex items-start gap-1.5 text-xs text-red-600">
                  <XCircle size={12} className="shrink-0 mt-0.5" />
                  <span><strong>{f.name}</strong>: {f.reason}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <ShieldCheck size={12} /> All hard filters passed
            </p>
          )}
        </div>
      </div>

      {/* Hard filters */}
      {fit.hardFilterPass && hardFilters.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {hardFilters.map(s => (
            <div key={s.id} className={`flex items-center gap-1.5 text-[11px] rounded px-2 py-1 border ${
              s.result.status === "PASS" ? "bg-green-50 border-green-200 text-green-700" :
              s.result.status === "FAIL" ? "bg-red-50 border-red-200 text-red-700" :
              "bg-slate-50 border-slate-200 text-slate-500"
            }`}>
              {s.result.status === "PASS" ? <CheckCircle2 size={10} className="shrink-0" /> :
               s.result.status === "FAIL" ? <XCircle size={10} className="shrink-0" /> :
               <HelpCircle size={10} className="shrink-0" />}
              <span className="font-medium truncate">{s.name}</span>
              <span className="ml-auto shrink-0 font-mono">{s.result.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Signals */}
      {signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Zap size={10} /> Weighted signals
          </p>
          {signals.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <div className={`shrink-0 ${s.result.status === "PASS" ? "text-emerald-500" : s.result.status === "FAIL" ? "text-red-400" : "text-slate-300"}`}>
                {s.result.status === "PASS" ? <CheckCircle2 size={12} /> :
                 s.result.status === "FAIL" ? <XCircle size={12} /> :
                 <HelpCircle size={12} />}
              </div>
              <span className={`flex-1 ${s.result.status === "UNKNOWN" ? "text-slate-400" : "text-slate-700"}`}>{s.name}</span>
              <span className="text-[10px] text-slate-400">{IMPORTANCE_LABEL[Math.round(s.importance)]}</span>
              <span className={`font-medium text-[11px] w-20 text-right ${
                s.result.status === "PASS" ? "text-emerald-600" :
                s.result.status === "FAIL" ? "text-red-500" : "text-slate-400 italic"
              }`}>{s.result.label}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Computed live from sourced data. Qualitative criteria (independence, cap table) show as
        &ldquo;needs review&rdquo; — add to pipeline to assess and score them.
      </p>
    </div>
  );
}

export function CompanyPreviewModal({
  company,
  open,
  onClose,
  addedId,
  adding,
  onAdd,
}: {
  company: CompanyPreviewData | null;
  open: boolean;
  onClose: () => void;
  addedId: string | null;
  adding: boolean;
  onAdd: () => void;
}) {
  if (!company) return null;

  const score = company.fitScore ?? company.huntScore ?? null;
  const rationale = company.fitRationale ?? company.huntRationale ?? null;
  const rationaleLabel = company.fitRationale ? "Thesis fit rationale" : "Why it matches";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="truncate">{company.name}</span>
            {score != null && <ScoreBadge score={score} label={company.fitScore != null ? "fit" : "match"} />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {company.sector && <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">{company.sector}</span>}
            {company.subSector && <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{company.subSector}</span>}
            {company.stage && <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{company.stage}</span>}
            {company.geography && <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{company.geography}</span>}
            {company.founded && <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Est. {company.founded}</span>}
          </div>

          {company.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{company.description}</p>
          )}

          {rationale && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-3">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Sparkles size={11} />{rationaleLabel}
              </p>
              <p className="text-sm text-emerald-900 leading-relaxed">{rationale}</p>
            </div>
          )}

          <MetricRow arrEstimate={company.arrEstimate ?? null} arrGrowth={company.arrGrowth ?? null} employees={company.employees ?? null} />

          {/* Thesis fit scorecard — computed live, no pipeline add required */}
          <div className="border border-slate-200 rounded-lg p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              Thesis Fit Scorecard
            </p>
            <ThesisFitScorecard company={company} />
          </div>

          {company.totalFundingM != null && (
            <p className="text-xs text-slate-500">Total raised: <span className="font-semibold text-slate-700">${company.totalFundingM}M</span></p>
          )}

          {company.source && (
            <p className="text-[10px] text-slate-400 italic">{company.source}</p>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          {addedId ? (
            <>
              <Link href={`/outreach?companyId=${addedId}`} className="flex-1" onClick={onClose}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  <Send size={14} /> Draft outreach
                </Button>
              </Link>
              <Link href={`/companies/${addedId}`} onClick={onClose}>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                  Full profile <ArrowRight size={13} />
                </Button>
              </Link>
            </>
          ) : (
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onAdd}
              disabled={adding}
            >
              <Building2 size={14} className="mr-1.5" />
              {adding ? "Adding…" : "Add to pipeline"}
            </Button>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="px-3 shrink-0">
                <ExternalLink size={14} />
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
