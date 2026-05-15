"use client";

import Link from "next/link";
import { TrendingUp, Users, DollarSign, ExternalLink, Building2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  fitScore?: number | null;
  fitRationale?: string | null;
  huntScore?: number | null;
  huntRationale?: string | null;
  source?: string | null;
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
  const rationaleLabel = company.fitRationale ? "Thesis fit" : "Why it matches";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5">{rationaleLabel}</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{rationale}</p>
            </div>
          )}

          <MetricRow arrEstimate={company.arrEstimate ?? null} arrGrowth={company.arrGrowth ?? null} employees={company.employees ?? null} />

          {company.totalFundingM != null && (
            <p className="text-xs text-slate-500">Total raised: <span className="font-semibold text-slate-700">${company.totalFundingM}M</span></p>
          )}

          {company.source && (
            <p className="text-[10px] text-slate-400 italic">{company.source}</p>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed">
            The full thesis fit panel and investment scorecard are on the company detail page — available after adding to pipeline.
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          {addedId ? (
            <Link href={`/companies/${addedId}`} className="flex-1" onClick={onClose}>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                View full profile <ArrowRight size={14} />
              </Button>
            </Link>
          ) : (
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onAdd}
              disabled={adding}
            >
              <Building2 size={14} className="mr-1.5" />
              {adding ? "Adding…" : "Add to pipeline & view full profile"}
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
