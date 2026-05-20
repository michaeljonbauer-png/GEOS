"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Printer,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  computeUnderwriteScore,
  KPI_DEFINITIONS,
  scoreKPI,
} from "@/lib/underwrite-scoring";

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
  underwriteId: string;
  section: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface UnderwriteDetail {
  id: string;
  companyId: string;
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "SCREENING", label: "Screening" },
  { value: "IN_ANALYSIS", label: "In Analysis" },
  { value: "READY_FOR_IC", label: "Ready for IC" },
  { value: "PASSED", label: "Passed" },
];

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

const SECTION_OPTIONS = [
  { value: "scorecard", label: "Scorecard" },
  { value: "arr", label: "ARR Analysis" },
  { value: "retention", label: "Retention" },
  { value: "financials", label: "Financials" },
  { value: "memo", label: "Investment Memo" },
  { value: "general", label: "General" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return "bg-emerald-100 text-emerald-700";
  if (score >= 6) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function scoreBorderColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-yellow-500";
  return "bg-red-500";
}

function formatArr(val?: number | null): string {
  if (val == null) return "—";
  if (val >= 1) return `$${val.toFixed(1)}M`;
  return `$${(val * 1000).toFixed(0)}K`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UnderwriteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [uw, setUw] = useState<UnderwriteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [analystInput, setAnalystInput] = useState("");

  // comment form
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentSection, setCommentSection] = useState("general");
  const [commentContent, setCommentContent] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // debounce ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Record<string, unknown>>({});

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchUw = useCallback(async () => {
    try {
      const res = await fetch(`/api/underwrite/${id}`);
      if (!res.ok) { router.push("/underwrite"); return; }
      const data: UnderwriteDetail = await res.json();
      setUw(data);
      setAnalystInput(data.analystName ?? "");
    } catch {
      router.push("/underwrite");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchUw(); }, [fetchUw]);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((fields: Record<string, unknown>) => {
    pendingPatch.current = { ...pendingPatch.current, ...fields };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const patch = { ...pendingPatch.current };
      pendingPatch.current = {};
      try {
        const res = await fetch(`/api/underwrite/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const updated = await res.json();
          setUw((prev) => prev ? { ...prev, ...updated } : prev);
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        }
      } catch {
        setSaveState("idle");
      }
    }, 1500);
  }, [id]);

  // Immediate save (for selects, on-blur)
  const immediateSave = useCallback(async (fields: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/underwrite/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const updated = await res.json();
        setUw((prev) => prev ? { ...prev, ...updated } : prev);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch {
      setSaveState("idle");
    }
  }, [id]);

  // ── KPI helpers ────────────────────────────────────────────────────────────

  const kpiValues = uw ? {
    arrGrowth: uw.arrGrowth ?? undefined,
    ndr: uw.ndr ?? undefined,
    gdr: uw.gdr ?? undefined,
    logoRetention: uw.logoRetention ?? undefined,
    grossMargin: uw.grossMargin ?? undefined,
    ruleOf40: uw.ruleOf40 ?? undefined,
    burnMultiple1yr: uw.burnMultiple1yr ?? undefined,
    burnMultipleLtd: uw.burnMultipleLtd ?? undefined,
  } : {};

  const { composite, kpis } = computeUnderwriteScore(kpiValues);
  const enteredCount = kpis.length;

  // ── Share ──────────────────────────────────────────────────────────────────

  const handleShare = () => {
    if (!uw) return;
    const url = `${window.location.origin}/underwrite/share/${uw.shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Copied!", description: "Share link copied to clipboard." });
    });
  };

  // ── Comment submit ─────────────────────────────────────────────────────────

  const submitComment = async () => {
    if (!commentAuthor.trim() || !commentContent.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/underwrite/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: commentSection,
          authorName: commentAuthor.trim(),
          content: commentContent.trim(),
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setUw((prev) =>
          prev ? { ...prev, comments: [...prev.comments, newComment] } : prev
        );
        setCommentContent("");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64 text-slate-400">
        Loading…
      </div>
    );
  }

  if (!uw) return null;

  const compositeColor = composite !== null
    ? (composite >= 8 ? "text-emerald-600" : composite >= 6 ? "text-yellow-600" : "text-red-600")
    : "text-slate-400";

  // Group comments by section
  const commentsBySection: Record<string, UnderwriteComment[]> = {};
  for (const c of uw.comments) {
    if (!commentsBySection[c.section]) commentsBySection[c.section] = [];
    commentsBySection[c.section].push(c);
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          aside, nav, [data-sidebar], .no-print { display: none !important; }
          .print-show { display: block !important; }
          [role="tablist"] { display: none !important; }
          [role="tabpanel"] { display: block !important; opacity: 1 !important; }
          body { background: white; }
          .page-header-actions { display: none !important; }
        }
      `}</style>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Top row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/underwrite" className="no-print">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-900 -ml-2">
                <ArrowLeft size={16} />
                Back
              </Button>
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={`/companies/${uw.company.id}`}
                className="text-xl font-bold text-slate-900 hover:text-blue-600 transition-colors truncate block"
              >
                {uw.company.name}
              </Link>
              {uw.company.sector && (
                <span className="text-sm text-slate-500">{uw.company.sector}</span>
              )}
            </div>

            {/* Save indicator */}
            <div className="no-print text-xs text-slate-400 min-w-[60px] text-right">
              {saveState === "saving" && <span className="text-amber-500">Saving…</span>}
              {saveState === "saved" && (
                <span className="text-emerald-500 flex items-center gap-1 justify-end">
                  <Check size={12} /> Saved
                </span>
              )}
            </div>

            <div className="page-header-actions no-print flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 size={14} />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                <Printer size={14} />
                Print
              </Button>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap no-print">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Status</Label>
              <Select
                value={uw.status}
                onValueChange={(val) => {
                  setUw((prev) => prev ? { ...prev, status: val } : prev);
                  immediateSave({ status: val });
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recommendation badge */}
            {uw.recommendation && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${REC_COLORS[uw.recommendation] ?? "bg-slate-100 text-slate-700"}`}>
                {uw.recommendation}
              </span>
            )}

            {/* Analyst */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Analyst</Label>
              <Input
                className="h-8 text-xs w-36"
                placeholder="Analyst name"
                value={analystInput}
                onChange={(e) => {
                  setAnalystInput(e.target.value);
                  scheduleSave({ analystName: e.target.value });
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="scorecard" className="w-full">
          <TabsList className="no-print mb-4 flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg w-full justify-start">
            <TabsTrigger value="scorecard" className="text-xs px-3 py-1.5">Scorecard</TabsTrigger>
            <TabsTrigger value="arr" className="text-xs px-3 py-1.5">ARR Analysis</TabsTrigger>
            <TabsTrigger value="retention" className="text-xs px-3 py-1.5">Retention</TabsTrigger>
            <TabsTrigger value="financials" className="text-xs px-3 py-1.5">Financials</TabsTrigger>
            <TabsTrigger value="memo" className="text-xs px-3 py-1.5">Investment Memo</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs px-3 py-1.5">
              Comments {uw.comments.length > 0 && `(${uw.comments.length})`}
            </TabsTrigger>
          </TabsList>

          {/* ── Scorecard Tab ── */}
          <TabsContent value="scorecard">
            <div className="print-section">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">KPI Scorecard</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* KPI inputs */}
                <div className="lg:col-span-2 space-y-3">
                  {KPI_DEFINITIONS.map((def) => {
                    const rawVal = (uw as unknown as Record<string, unknown>)[def.key] as number | null | undefined;
                    const band = rawVal != null ? scoreKPI(def, rawVal) : null;

                    return (
                      <Card key={def.key} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-slate-800">{def.name}</span>
                              {def.unit && (
                                <span className="text-xs text-slate-400">({def.unit})</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mb-2">{def.description}</p>
                            <Input
                              type="number"
                              placeholder={def.placeholder}
                              className="h-8 text-sm w-32"
                              defaultValue={rawVal ?? ""}
                              onBlur={(e) => {
                                const parsed = e.target.value === "" ? null : parseFloat(e.target.value);
                                setUw((prev) => {
                                  if (!prev) return prev;
                                  return { ...prev, [def.key]: parsed };
                                });
                                immediateSave({ [def.key]: parsed });
                              }}
                            />
                          </div>
                          {band && (
                            <div className="text-right flex-shrink-0">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreColor(band.score)}`}>
                                {band.score}/10
                              </span>
                              <p className="text-xs text-slate-400 mt-1 max-w-[120px] text-right leading-tight">
                                {band.label}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Summary panel */}
                <div className="lg:col-span-1">
                  <Card className="p-4 sticky top-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-1">Composite Score</h3>
                    <p className="text-xs text-slate-400 mb-3">{enteredCount} of 8 KPIs entered</p>

                    <div className={`text-4xl font-bold mb-4 ${compositeColor}`}>
                      {composite !== null ? `${composite.toFixed(1)}` : "—"}
                      <span className="text-lg text-slate-400 font-normal"> / 10</span>
                    </div>

                    {kpis.length > 0 && (
                      <div className="space-y-2">
                        {kpis.map((k) => (
                          <div key={k.key}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-slate-500 truncate">{k.name}</span>
                              <span className="text-xs font-medium text-slate-700 ml-2 flex-shrink-0">{k.score}/10</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${scoreBorderColor(k.score)}`}
                                style={{ width: `${(k.score / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {kpis.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Enter KPI values to see your scorecard.
                      </p>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── ARR Analysis Tab ── */}
          <TabsContent value="arr">
            <div className="print-section">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">ARR Analysis</h2>
              {/* Reference pills */}
              <div className="flex flex-wrap gap-2 mb-4">
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
                {uw.company.stage && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                    {uw.company.stage}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="arr-notes" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  ARR Analysis Notes
                </Label>
                <Textarea
                  id="arr-notes"
                  rows={12}
                  placeholder="Document ARR bridge, new vs. expansion vs. contraction, cohort analysis, seasonality…"
                  className="text-sm resize-y"
                  defaultValue={uw.arrNotes ?? ""}
                  onChange={(e) => scheduleSave({ arrNotes: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Retention Tab ── */}
          <TabsContent value="retention">
            <div className="print-section">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">Retention Analysis</h2>
              {/* Reference pills */}
              <div className="flex flex-wrap gap-2 mb-4">
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
                {(uw.gdr == null && uw.ndr == null && uw.logoRetention == null) && (
                  <span className="text-xs text-slate-400">Enter GDR, NDR, and Logo Retention in the Scorecard to see reference values here.</span>
                )}
              </div>

              <div>
                <Label htmlFor="retention-notes" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Retention Analysis
                </Label>
                <Textarea
                  id="retention-notes"
                  rows={12}
                  placeholder="GDR/NDR breakdown, logo churn cohorts, expansion motion, at-risk segments…"
                  className="text-sm resize-y"
                  defaultValue={uw.retentionNotes ?? ""}
                  onChange={(e) => scheduleSave({ retentionNotes: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Financials Tab ── */}
          <TabsContent value="financials">
            <div className="print-section">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">Financial Review</h2>
              <div>
                <Label htmlFor="financial-notes" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Financial Review
                </Label>
                <Textarea
                  id="financial-notes"
                  rows={14}
                  placeholder="P&L observations, burn rate, margins trajectory, balance sheet, revenue quality…"
                  className="text-sm resize-y"
                  defaultValue={uw.financialNotes ?? ""}
                  onChange={(e) => scheduleSave({ financialNotes: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Investment Memo Tab ── */}
          <TabsContent value="memo">
            <div className="print-section space-y-5">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">Investment Memo</h2>

              {/* Merits */}
              <div>
                <Label htmlFor="memo-merits" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Key Merits
                </Label>
                <Textarea
                  id="memo-merits"
                  rows={6}
                  placeholder="What makes this opportunity compelling…"
                  className="text-sm resize-y"
                  defaultValue={uw.memoMerits ?? ""}
                  onChange={(e) => scheduleSave({ memoMerits: e.target.value })}
                />
              </div>

              {/* Risks */}
              <div>
                <Label htmlFor="memo-risks" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Key Risks &amp; Mitigants
                </Label>
                <Textarea
                  id="memo-risks"
                  rows={6}
                  placeholder="Risks and how we'd address them…"
                  className="text-sm resize-y"
                  defaultValue={uw.memoRisks ?? ""}
                  onChange={(e) => scheduleSave({ memoRisks: e.target.value })}
                />
              </div>

              {/* Narrative */}
              <div>
                <Label htmlFor="memo-narrative" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Investment Narrative
                </Label>
                <Textarea
                  id="memo-narrative"
                  rows={8}
                  placeholder="Full investment thesis narrative…"
                  className="text-sm resize-y"
                  defaultValue={uw.memoNarrative ?? ""}
                  onChange={(e) => scheduleSave({ memoNarrative: e.target.value })}
                />
              </div>

              {/* Recommendation */}
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                  Recommendation
                </Label>
                <Select
                  value={uw.recommendation ?? ""}
                  onValueChange={(val) => {
                    setUw((prev) => prev ? { ...prev, recommendation: val || null } : prev);
                    immediateSave({ recommendation: val || null });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-40">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INVEST">INVEST</SelectItem>
                    <SelectItem value="PASS">PASS</SelectItem>
                    <SelectItem value="WATCH">WATCH</SelectItem>
                  </SelectContent>
                </Select>
                {uw.recommendation && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${REC_COLORS[uw.recommendation] ?? "bg-slate-100 text-slate-700"}`}>
                    {uw.recommendation}
                  </span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Comments Tab ── */}
          <TabsContent value="comments">
            <div className="print-section space-y-6">
              <h2 className="text-base font-semibold text-slate-700 mb-3 hidden print:block">Comments</h2>

              {/* Add comment form */}
              <Card className="p-4 no-print">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Comment</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="comment-author" className="text-xs text-slate-500 mb-1 block">
                        Your Name
                      </Label>
                      <Input
                        id="comment-author"
                        placeholder="Your name"
                        className="h-8 text-sm"
                        value={commentAuthor}
                        onChange={(e) => setCommentAuthor(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="comment-section" className="text-xs text-slate-500 mb-1 block">
                        Section
                      </Label>
                      <Select value={commentSection} onValueChange={setCommentSection}>
                        <SelectTrigger id="comment-section" className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTION_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="comment-content" className="text-xs text-slate-500 mb-1 block">
                      Comment
                    </Label>
                    <Textarea
                      id="comment-content"
                      placeholder="Add your comment…"
                      rows={3}
                      className="text-sm"
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={submitComment}
                    disabled={submittingComment || !commentAuthor.trim() || !commentContent.trim()}
                  >
                    {submittingComment ? "Posting…" : "Post Comment"}
                  </Button>
                </div>
              </Card>

              {/* Comment list */}
              {uw.comments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No comments yet. Be the first to add one.</p>
              ) : (
                <div className="space-y-4">
                  {SECTION_OPTIONS.filter((s) => commentsBySection[s.value]?.length > 0).map((s) => (
                    <div key={s.value}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        {s.label}
                      </h4>
                      <div className="space-y-2">
                        {(commentsBySection[s.value] ?? []).map((c) => (
                          <Card key={c.id} className="p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-medium text-slate-800">{c.authorName}</span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600`}>
                                {s.label}
                              </span>
                              <span className="text-xs text-slate-400 ml-auto">{relativeTime(c.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* uncategorized comments that don't match section options */}
                  {Object.entries(commentsBySection)
                    .filter(([key]) => !SECTION_OPTIONS.find((s) => s.value === key))
                    .map(([key, comments]) => (
                      <div key={key}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{key}</h4>
                        <div className="space-y-2">
                          {comments.map((c) => (
                            <Card key={c.id} className="p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm font-medium text-slate-800">{c.authorName}</span>
                                <span className="text-xs text-slate-400 ml-auto">{relativeTime(c.createdAt)}</span>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
