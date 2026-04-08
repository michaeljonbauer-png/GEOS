"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, Zap, HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { ThesisFitResult } from "@/lib/thesis";
import Link from "next/link";

interface Props {
  companyId: string;
}

const IMPORTANCE_LABEL: Record<number, string> = { 1: "Low", 2: "Low", 3: "Med", 4: "High", 5: "Critical" };

export default function ThesisFitPanel({ companyId }: Props) {
  const [fit, setFit] = useState<ThesisFitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${companyId}/fit`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); } else { setFit(data); }
      })
      .catch(() => setError("Failed to compute fit"))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="text-xs text-slate-400 py-4 text-center">Computing thesis fit…</div>;
  if (error) return <div className="text-xs text-red-400 py-2">{error}</div>;
  if (!fit) return null;

  const hardFilters = fit.signals.filter((s) => s.category === "HARD_FILTER");
  const signals = fit.signals.filter((s) => s.category === "SIGNAL");

  const scoreColor =
    !fit.hardFilterPass ? "text-red-600" :
    fit.score === null ? "text-slate-400" :
    fit.score >= 75 ? "text-emerald-600" :
    fit.score >= 50 ? "text-yellow-600" :
    "text-red-500";

  const scoreBgBar =
    !fit.hardFilterPass ? "bg-red-500" :
    fit.score === null ? "bg-slate-200" :
    fit.score >= 75 ? "bg-emerald-500" :
    fit.score >= 50 ? "bg-yellow-500" :
    "bg-red-500";

  return (
    <div className="space-y-4">
      {/* Score summary */}
      <div className="flex items-center gap-4">
        <div className="text-center shrink-0">
          {fit.hardFilterPass ? (
            <>
              <span className={`text-4xl font-black ${scoreColor}`}>
                {fit.score !== null ? `${fit.score}%` : "—"}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Thesis Fit</p>
            </>
          ) : (
            <>
              <span className="text-3xl font-black text-red-600">✕</span>
              <p className="text-[10px] text-red-400 mt-0.5 uppercase tracking-wide">Does Not Fit</p>
            </>
          )}
        </div>
        <div className="flex-1">
          {fit.hardFilterPass && fit.score !== null && (
            <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${scoreBgBar}`} style={{ width: `${fit.score}%` }} />
            </div>
          )}
          {!fit.hardFilterPass && (
            <div className="space-y-1">
              {fit.failedFilters.map((f) => (
                <div key={f.id} className="flex items-start gap-1.5 text-xs text-red-600">
                  <XCircle size={13} className="shrink-0 mt-0.5" />
                  <span><strong>{f.name}</strong>: {f.reason}</span>
                </div>
              ))}
            </div>
          )}
          {fit.hardFilterPass && fit.failedFilters.length === 0 && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <ShieldCheck size={13} /> All hard filters passed
            </p>
          )}
        </div>
      </div>

      {/* Hard filter status row */}
      {fit.hardFilterPass && hardFilters.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {hardFilters.map((s) => (
            <div key={s.id} className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 border ${s.result.status === "PASS" ? "bg-green-50 border-green-200 text-green-700" : s.result.status === "FAIL" ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
              {s.result.status === "PASS" ? <CheckCircle2 size={11} className="shrink-0" /> : s.result.status === "FAIL" ? <XCircle size={11} className="shrink-0" /> : <HelpCircle size={11} className="shrink-0" />}
              <span className="font-medium truncate">{s.name}</span>
              <span className="ml-auto shrink-0 font-mono">{s.result.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Signal breakdown */}
      {signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Zap size={11} /> Signals
          </p>
          {signals.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <div className={`shrink-0 ${s.result.status === "PASS" ? "text-emerald-500" : s.result.status === "FAIL" ? "text-red-400" : "text-slate-300"}`}>
                {s.result.status === "PASS" ? <CheckCircle2 size={13} /> : s.result.status === "FAIL" ? <XCircle size={13} /> : <HelpCircle size={13} />}
              </div>
              <span className={`flex-1 ${s.result.status === "UNKNOWN" ? "text-slate-400" : "text-slate-700"}`}>{s.name}</span>
              <span className="text-[10px] text-slate-400">{IMPORTANCE_LABEL[Math.round(s.importance)]}</span>
              <span className={`font-medium text-[11px] w-20 text-right ${s.result.status === "PASS" ? "text-emerald-600" : s.result.status === "FAIL" ? "text-red-500" : "text-slate-400 italic"}`}>
                {s.result.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center pt-1">
        <Link href="/settings?tab=thesis" className="hover:text-blue-500 underline">Edit thesis criteria</Link>
        {" · "}Missing data fields reduce the score — fill in company details to improve accuracy.
      </p>
    </div>
  );
}
