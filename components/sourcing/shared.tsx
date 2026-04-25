"use client";

import { TrendingUp, Users, DollarSign } from "lucide-react";

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
