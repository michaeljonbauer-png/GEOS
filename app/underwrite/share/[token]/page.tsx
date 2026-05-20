"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { computeUnderwriteScore, KPI_DEFINITIONS, scoreKPI } from "@/lib/underwrite-scoring";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyDetail {
  id: string;
  name: string;
  sector?: string | null;
  arrEstimate?: number | null;
  arrGrowth?: number | null;
  nrrEstimate?: number | null;
  grossMargin?: number | null;
  employees?: number | null;
  founded?: number | null;
  stage?: string | null;
  website?: string | null;
}

interface UnderwriteComment {
  id: string;
  section: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface SharedUnderwrite {
  id: string;
  status: string;
  analystName?: string | null;
  shareToken: string;
  arrGrowth?: number | null;
  ndr?: number | null;
  gdr?: number | null;
  logoRetention?: number | null;
  grossMargin?: number | null;
  ruleOf40?: number | null;
  burnMultiple1yr?: number | null;
  burnMultipleLtd?: number | null;
  arrNotes?: string | null;
  retentionNotes?: string | null;
  financialNotes?: string | null;
  memoMerits?: string | null;
  memoRisks?: string | null;
  memoNarrative?: string | null;
  recommendation?: string | null;
  company: CompanyDetail;
  comments: UnderwriteComment[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  SCREENING: "Screening",
  IN_ANALYSIS: "In Analysis",
  READY_FOR_IC: "Ready for IC",
  PASSED: "Passed",
};

const STATUS_COLORS: Record<string, string> = {
  SCREENING: "bg-slate-100 text-slate-700",
  IN_ANALYSIS: "bg-blue-100 text-blue-700",
  READY_FOR_IC: "bg-emerald-100 text-emerald-700",
  PASSED: "bg-red-100 text-red-700",
};

const REC_COLORS: Record<string, string> = {
  INVEST: "bg-emerald-100 text-emerald-700",
  PASS: "bg-red-100 text-red-700",
  WATCH: "bg-amber-100 text-amber-700",
};

function scoreColor(score: number): string {
  if (score >= 8) return "bg-emerald-100 text-emerald-700";
  if (score >= 6) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-yellow-500";
  return "bg-red-500";
}

function formatArr(val?: number | null): string {
  if (val == null) return "—";
  if (val >= 1) return `$${val.toFixed(1)}M`;
  return `$${(val * 1000).toFixed(0)}K`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Section block ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [uw, setUw] = useState<SharedUnderwrite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/underwrite/share/${token}`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setUw(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (notFound || !uw) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <ClipboardList size={40} className="text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">Not Found</h1>
        <p className="text-slate-500 text-sm max-w-xs">
          This shared underwrite link is invalid or has been removed.
        </p>
      </div>
    );
  }

  const kpiValues = {
    arrGrowth: uw.arrGrowth ?? undefined,
    ndr: uw.ndr ?? undefined,
    gdr: uw.gdr ?? undefined,
    logoRetention: uw.logoRetention ?? undefined,
    grossMargin: uw.grossMargin ?? undefined,
    ruleOf40: uw.ruleOf40 ?? undefined,
    burnMultiple1yr: uw.burnMultiple1yr ?? undefined,
    burnMultipleLtd: uw.burnMultipleLtd ?? undefined,
  };

  const { composite, kpis } = computeUnderwriteScore(kpiValues);
  const compositeColor = composite !== null
    ? (composite >= 8 ? "text-emerald-600" : composite >= 6 ? "text-yellow-600" : "text-red-600")
    : "text-slate-400";

  const hasScorecard = kpis.length > 0;
  const hasArrNotes = !!uw.arrNotes?.trim();
  const hasRetentionNotes = !!uw.retentionNotes?.trim();
  const hasFinancialNotes = !!uw.financialNotes?.trim();
  const hasMemo = !!(uw.memoMerits?.trim() || uw.memoRisks?.trim() || uw.memoNarrative?.trim());

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={18} className="text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Underwrite Analysis
            </span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-1">{uw.company.name}</h1>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {uw.company.sector && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                {uw.company.sector}
              </span>
            )}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[uw.status] ?? "bg-slate-100 text-slate-700"}`}>
              {STATUS_LABELS[uw.status] ?? uw.status}
            </span>
            {uw.recommendation && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${REC_COLORS[uw.recommendation] ?? "bg-slate-100 text-slate-700"}`}>
                {uw.recommendation}
              </span>
            )}
            {uw.company.stage && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                {uw.company.stage}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              ARR: {formatArr(uw.company.arrEstimate)}
            </span>
          </div>
        </div>

        {/* Scorecard summary */}
        {hasScorecard && (
          <Section title="KPI Scorecard">
            <Card className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <div>
                  <div className={`text-4xl font-bold ${compositeColor}`}>
                    {composite !== null ? composite.toFixed(1) : "—"}
                    <span className="text-lg text-slate-400 font-normal"> / 10</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{kpis.length} of 8 KPIs scored</p>
                </div>
              </div>

              <div className="space-y-3">
                {KPI_DEFINITIONS.map((def) => {
                  const rawVal = (uw as unknown as Record<string, unknown>)[def.key] as number | null | undefined;
                  if (rawVal == null) return null;
                  const band = scoreKPI(def, rawVal);
                  if (!band) return null;
                  return (
                    <div key={def.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-700">{def.name}</span>
                          <span className="text-xs text-slate-400">
                            {rawVal.toFixed(def.unit === "×" ? 2 : 1)}{def.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{band.label}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${scoreColor(band.score)}`}>
                            {band.score}/10
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBg(band.score)}`}
                          style={{ width: `${(band.score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Section>
        )}

        {/* ARR Analysis */}
        {hasArrNotes && (
          <Section title="ARR Analysis">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                <span className="text-slate-400">ARR</span>
                <span className="font-medium">{formatArr(uw.company.arrEstimate)}</span>
              </span>
              {uw.company.arrGrowth != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                  <span className="text-slate-400">Growth</span>
                  <span className="font-medium">{uw.company.arrGrowth.toFixed(0)}%</span>
                </span>
              )}
            </div>
            <Card className="p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.arrNotes}</p>
            </Card>
          </Section>
        )}

        {/* Retention */}
        {hasRetentionNotes && (
          <Section title="Retention Analysis">
            <div className="flex flex-wrap gap-2 mb-3">
              {uw.gdr != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                  <span className="text-slate-400">GDR</span>
                  <span className="font-medium">{uw.gdr.toFixed(1)}%</span>
                </span>
              )}
              {uw.ndr != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                  <span className="text-slate-400">NDR</span>
                  <span className="font-medium">{uw.ndr.toFixed(1)}%</span>
                </span>
              )}
              {uw.logoRetention != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                  <span className="text-slate-400">Logo Ret.</span>
                  <span className="font-medium">{uw.logoRetention.toFixed(1)}%</span>
                </span>
              )}
            </div>
            <Card className="p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.retentionNotes}</p>
            </Card>
          </Section>
        )}

        {/* Financials */}
        {hasFinancialNotes && (
          <Section title="Financial Review">
            <Card className="p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.financialNotes}</p>
            </Card>
          </Section>
        )}

        {/* Investment Memo */}
        {hasMemo && (
          <Section title="Investment Memo">
            <div className="space-y-4">
              {uw.memoMerits?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">Key Merits</h3>
                  <Card className="p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.memoMerits}</p>
                  </Card>
                </div>
              )}
              {uw.memoRisks?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">Key Risks &amp; Mitigants</h3>
                  <Card className="p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.memoRisks}</p>
                  </Card>
                </div>
              )}
              {uw.memoNarrative?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">Investment Narrative</h3>
                  <Card className="p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{uw.memoNarrative}</p>
                  </Card>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 pt-6 mt-8">
          <p className="text-xs text-slate-400">
            {uw.analystName ? (
              <>Shared by <span className="font-medium text-slate-600">{uw.analystName}</span> · </>
            ) : null}
            {formatDate(uw.updatedAt)}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Generated by GEOS — Growth Equity Operating System
          </p>
        </div>
      </div>
    </div>
  );
}
