"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Plus, X, Check, ChevronDown, ChevronUp, Search, Zap,
  Heart, HeartOff, ArrowUpRight, AlertCircle, Info,
  Shuffle, Users, TrendingUp, DollarSign,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deal {
  id: string; codeName: string; vertical: string; endMarket?: string | null;
  description?: string | null; stage?: string | null;
  arrM?: number | null; yoyGrowth?: number | null; totalRaisedM?: number | null;
  ndr?: number | null; gdr?: number | null; ltmEbitdaM?: number | null;
  customerCount?: number | null; acvK?: number | null;
  status: string; createdAt: string;
  interests: { handle: string }[];
}

interface Profile {
  id?: string; handle: string;
  minArrM?: number | null; maxArrM?: number | null;
  minYoyGrowth?: number | null; maxRaisedM?: number | null;
  minGdr?: number | null; minNdr?: number | null;
  verticals: string; notes?: string | null;
}

type FitColor = "emerald" | "blue" | "amber" | "slate" | "red";
interface FitResult { score: number; label: string; color: FitColor; reasons: string[] }

// ── Constants ─────────────────────────────────────────────────────────────────

const VERTICALS = [
  "B2B SaaS", "FinTech", "HealthTech / MedTech", "EdTech", "MarTech / AdTech",
  "DevTools / DevOps", "Supply Chain / Logistics", "Construction Tech",
  "Manufacturing / Industrial", "AgTech", "PropTech", "HR Tech", "Legal Tech",
  "Cybersecurity", "Data & Analytics", "AI / ML Platform", "ERP / ERP Adjacent",
  "Field Service", "Insurance Tech", "GovTech", "Other",
];
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Growth"];
const CODE_NAMES = [
  "Project Apex","Project Aurora","Project Beacon","Project Blaze","Project Cedar",
  "Project Cipher","Project Cobalt","Project Compass","Project Dune","Project Echo",
  "Project Eclipse","Project Ember","Project Falcon","Project Forge","Project Glacier",
  "Project Harbor","Project Haven","Project Horizon","Project Indigo","Project Jade",
  "Project Jupiter","Project Keystone","Project Lark","Project Lumen","Project Lynx",
  "Project Maple","Project Mesa","Project Meteor","Project Mira","Project Nimbus",
  "Project Nova","Project Opal","Project Orbit","Project Osprey","Project Paladin",
  "Project Pioneer","Project Prism","Project Quartz","Project Quest","Project Raven",
  "Project Reef","Project Ridge","Project Sage","Project Sequoia","Project Sierra",
  "Project Slate","Project Solar","Project Spark","Project Summit","Project Swift",
  "Project Talon","Project Tidal","Project Timber","Project Titan","Project Torch",
  "Project Vega","Project Vertex","Project Vortex","Project Willow","Project Zenith",
];

const BLANK_DEAL = {
  codeName: "", vertical: "", endMarket: "", description: "", stage: "",
  arrM: "", yoyGrowth: "", totalRaisedM: "", ndr: "", gdr: "",
  ltmEbitdaM: "", customerCount: "", acvK: "",
};
const BLANK_PROFILE: Omit<Profile, "id"> = {
  handle: "", minArrM: null, maxArrM: null, minYoyGrowth: null,
  maxRaisedM: null, minGdr: null, minNdr: null, verticals: "[]", notes: "",
};

// ── Fit Scoring ───────────────────────────────────────────────────────────────

function computeFit(deal: Deal, profile: Profile | null): FitResult | null {
  if (!profile) return null;
  const verts: string[] = (() => { try { return JSON.parse(profile.verticals); } catch { return []; } })();
  const noPrefs = !profile.minArrM && !profile.maxArrM && !profile.minYoyGrowth &&
    !profile.maxRaisedM && !profile.minGdr && !profile.minNdr && verts.length === 0;
  if (noPrefs) return null;

  // Hard dealbreakers → 0
  if (profile.minArrM && deal.arrM != null && deal.arrM < profile.minArrM)
    return { score: 0, label: "Below ARR Min", color: "red", reasons: [`ARR ${fmt(deal.arrM,"M")} < min ${fmt(profile.minArrM,"M")}`] };
  if (profile.maxArrM && deal.arrM != null && deal.arrM > profile.maxArrM)
    return { score: 0, label: "Above ARR Max", color: "red", reasons: [`ARR ${fmt(deal.arrM,"M")} > max ${fmt(profile.maxArrM,"M")}`] };
  if (profile.maxRaisedM && deal.totalRaisedM != null && deal.totalRaisedM > profile.maxRaisedM)
    return { score: 0, label: "Over-capitalized", color: "red", reasons: [`$${deal.totalRaisedM}M raised > max ${fmt(profile.maxRaisedM,"M")}`] };
  if (profile.minGdr && deal.gdr != null && deal.gdr < profile.minGdr)
    return { score: 0, label: "GDR too low", color: "red", reasons: [`GDR ${deal.gdr}% < min ${profile.minGdr}%`] };

  let pts = 0, maxPts = 0;
  const reasons: string[] = [];

  // Vertical (35 pts)
  if (verts.length > 0) {
    maxPts += 35;
    if (verts.includes(deal.vertical)) { pts += 35; reasons.push(`✓ ${deal.vertical}`); }
    else reasons.push(`✗ Vertical not in focus`);
  }
  // Growth (25 pts)
  if (profile.minYoyGrowth != null && deal.yoyGrowth != null) {
    maxPts += 25;
    if (deal.yoyGrowth >= profile.minYoyGrowth) { pts += 25; reasons.push(`✓ ${deal.yoyGrowth}% growth`); }
    else { pts += Math.max(0, Math.round(25 * deal.yoyGrowth / profile.minYoyGrowth)); reasons.push(`△ ${deal.yoyGrowth}% growth (min ${profile.minYoyGrowth}%)`); }
  }
  // NDR (25 pts)
  if (profile.minNdr != null && deal.ndr != null) {
    maxPts += 25;
    if (deal.ndr >= profile.minNdr) { pts += 25; reasons.push(`✓ NDR ${deal.ndr}%`); }
    else { pts += Math.max(0, Math.round(25 * deal.ndr / profile.minNdr)); reasons.push(`△ NDR ${deal.ndr}% (min ${profile.minNdr}%)`); }
  }
  // ARR bonus (15 pts)
  if ((profile.minArrM || profile.maxArrM) && deal.arrM != null) {
    maxPts += 15;
    const ok = (!profile.minArrM || deal.arrM >= profile.minArrM) && (!profile.maxArrM || deal.arrM <= profile.maxArrM);
    if (ok) { pts += 15; reasons.push(`✓ ARR in range`); }
  }

  if (maxPts === 0) return null;
  const score = Math.min(100, Math.round((pts / maxPts) * 100));
  const label = score >= 85 ? "Strong Fit" : score >= 65 ? "Good Fit" : score >= 40 ? "Partial Fit" : "Weak Fit";
  const color: FitColor = score >= 85 ? "emerald" : score >= 65 ? "blue" : score >= 40 ? "amber" : "slate";
  return { score, label, color, reasons };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, unit: "M" | "K" | "%" | ""): string {
  if (v == null) return "—";
  if (unit === "M") return `$${v % 1 === 0 ? v : v.toFixed(1)}M`;
  if (unit === "K") return `$${v % 1 === 0 ? v : v.toFixed(0)}K`;
  if (unit === "%") return `${v}%`;
  return String(v);
}
const daysAgo = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
};
const numOrNull = (s: string) => s.trim() === "" ? null : Number(s);

// ── Small UI helpers ──────────────────────────────────────────────────────────

function FitBadge({ fit }: { fit: FitResult }) {
  const cls: Record<FitColor, string> = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue:    "bg-blue-100 text-blue-700 border-blue-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
    slate:   "bg-slate-100 text-slate-500 border-slate-200",
    red:     "bg-red-100 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cls[fit.color]}`}>
      <Zap size={9} />{fit.score}% · {fit.label}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">{label}</div>
      <div className={`font-bold mt-0.5 ${value === "—" ? "text-slate-300 text-sm" : "text-slate-800 text-sm"}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    ACTIVE:  "bg-emerald-100 text-emerald-700",
    CLOSED:  "bg-slate-100 text-slate-500",
    MATCHED: "bg-blue-100 text-blue-700",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s[status] ?? s.ACTIVE}`}>{status}</span>;
}

function FieldInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder, prefix, suffix }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
        {prefix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200">{prefix}</span>}
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="flex-1 px-3 py-2 text-sm focus:outline-none"
        />
        {suffix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200">{suffix}</span>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Deal Card ─────────────────────────────────────────────────────────────────

function DealCard({
  deal, profile, myHandle, onInterest, onDelete,
}: {
  deal: Deal; profile: Profile | null; myHandle: string;
  onInterest: (dealId: string) => void;
  onDelete: (dealId: string) => void;
}) {
  const [showReasons, setShowReasons] = useState(false);
  const fit = useMemo(() => computeFit(deal, profile), [deal, profile]);
  const iAmInterested = deal.interests.some(i => i.handle === myHandle);
  const interestCount = deal.interests.length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{deal.codeName}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {deal.vertical}{deal.endMarket ? ` · ${deal.endMarket}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {deal.stage && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{deal.stage}</span>
          )}
          <StatusBadge status={deal.status} />
        </div>
      </div>

      {/* Description */}
      {deal.description && (
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{deal.description}</p>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50 px-3 py-3">
        <Stat label="ARR"       value={fmt(deal.arrM, "M")} />
        <Stat label="YoY Gr."   value={fmt(deal.yoyGrowth, "%")} />
        <Stat label="Raised"    value={fmt(deal.totalRaisedM, "M")} />
        <Stat label="NDR"       value={fmt(deal.ndr, "%")} />
        <Stat label="GDR"       value={fmt(deal.gdr, "%")} />
        <Stat label="ACV"       value={fmt(deal.acvK, "K")} />
        <Stat label="Customers" value={deal.customerCount != null ? String(deal.customerCount) : "—"} />
        <Stat label="EBITDA/Burn"
          value={deal.ltmEbitdaM == null ? "—" : deal.ltmEbitdaM < 0 ? `($${Math.abs(deal.ltmEbitdaM).toFixed(1)}M)` : fmt(deal.ltmEbitdaM, "M")}
          sub={deal.ltmEbitdaM != null && deal.ltmEbitdaM < 0 ? "annual burn" : undefined}
        />
      </div>

      {/* Footer: fit score + actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {fit && (
            <button
              onClick={() => setShowReasons(v => !v)}
              className="flex items-center gap-1 focus:outline-none"
              title="Show fit reasons"
            >
              <FitBadge fit={fit} />
              {showReasons ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
            </button>
          )}
          {myHandle && (
            <button
              onClick={() => onInterest(deal.id)}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                iAmInterested
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-500"
              }`}
              title={iAmInterested ? "Remove interest" : "Express interest (anonymous)"}
            >
              {iAmInterested ? <Heart size={10} fill="currentColor" /> : <Heart size={10} />}
              <span>{interestCount > 0 ? interestCount : ""} {iAmInterested ? "Interested" : "Interest"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-300">{daysAgo(deal.createdAt)}</span>
          <button
            onClick={() => onDelete(deal.id)}
            className="text-[10px] text-slate-300 hover:text-red-400 transition-colors px-1"
            title="Remove deal"
          >
            ×
          </button>
        </div>
      </div>

      {/* Fit reasons dropdown */}
      {showReasons && fit && fit.reasons.length > 0 && (
        <div className="bg-slate-50 rounded-xl px-3 py-2 space-y-0.5 border border-slate-100">
          {fit.reasons.map((r, i) => (
            <p key={i} className="text-[11px] text-slate-600">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DealFitPage() {
  const [tab, setTab] = useState<"board" | "profile">("board");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch]                 = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [filterStage, setFilterStage]       = useState("");
  const [filterStatus, setFilterStatus]     = useState("ACTIVE");
  const [sortBy, setSortBy]                 = useState<"date" | "arr" | "growth" | "fit">("date");

  // Submit form
  const [dealForm, setDealForm]   = useState({ ...BLANK_DEAL });
  const setDF = (k: string) => (v: string) => setDealForm(p => ({ ...p, [k]: v }));

  // Profile form
  const [profForm, setProfForm]   = useState({ ...BLANK_PROFILE, verticals: "[]" });
  const setPF = (k: string) => (v: string | null) => setProfForm(p => ({ ...p, [k]: v }));
  const profVerts: string[] = useMemo(() => { try { return JSON.parse(profForm.verticals); } catch { return []; } }, [profForm.verticals]);
  const toggleVert = (v: string) => {
    const next = profVerts.includes(v) ? profVerts.filter(x => x !== v) : [...profVerts, v];
    setProfForm(p => ({ ...p, verticals: JSON.stringify(next) }));
  };

  // My handle (localStorage)
  const [myHandle, setMyHandle] = useState("");
  useEffect(() => {
    const h = localStorage.getItem("dealfit_handle") ?? "";
    setMyHandle(h);
    if (h) setProfForm(p => ({ ...p, handle: h }));
  }, []);

  // Load data
  const loadDeals = async () => {
    const res = await fetch("/api/dealfit/deals");
    const data = await res.json().catch(() => ({}));
    setDeals(data.deals ?? []);
    setLoading(false);
  };
  const loadProfile = async (handle: string) => {
    if (!handle) return;
    const res = await fetch(`/api/dealfit/profile?handle=${encodeURIComponent(handle)}`);
    const data = await res.json().catch(() => ({}));
    if (data.profile) {
      setProfile(data.profile);
      setProfForm({
        handle: data.profile.handle,
        minArrM: data.profile.minArrM ?? null,
        maxArrM: data.profile.maxArrM ?? null,
        minYoyGrowth: data.profile.minYoyGrowth ?? null,
        maxRaisedM: data.profile.maxRaisedM ?? null,
        minGdr: data.profile.minGdr ?? null,
        minNdr: data.profile.minNdr ?? null,
        verticals: data.profile.verticals ?? "[]",
        notes: data.profile.notes ?? "",
      });
    }
  };
  useEffect(() => { loadDeals(); }, []);
  useEffect(() => {
    const h = localStorage.getItem("dealfit_handle") ?? "";
    if (h) loadProfile(h);
  }, []);

  // Submit deal
  const handleSubmitDeal = async () => {
    if (!dealForm.vertical) return;
    setSubmitting(true);
    await fetch("/api/dealfit/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codeName:      dealForm.codeName || CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)],
        vertical:      dealForm.vertical,
        endMarket:     dealForm.endMarket || null,
        description:   dealForm.description || null,
        stage:         dealForm.stage || null,
        arrM:          numOrNull(dealForm.arrM),
        yoyGrowth:     numOrNull(dealForm.yoyGrowth),
        totalRaisedM:  numOrNull(dealForm.totalRaisedM),
        ndr:           numOrNull(dealForm.ndr),
        gdr:           numOrNull(dealForm.gdr),
        ltmEbitdaM:    numOrNull(dealForm.ltmEbitdaM),
        customerCount: numOrNull(dealForm.customerCount),
        acvK:          numOrNull(dealForm.acvK),
      }),
    });
    setSubmitting(false);
    setShowSubmit(false);
    setDealForm({ ...BLANK_DEAL });
    await loadDeals();
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!profForm.handle.trim()) return;
    setSavingProfile(true);
    const res = await fetch("/api/dealfit/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...profForm,
        minArrM:      profForm.minArrM != null ? Number(profForm.minArrM) : null,
        maxArrM:      profForm.maxArrM != null ? Number(profForm.maxArrM) : null,
        minYoyGrowth: profForm.minYoyGrowth != null ? Number(profForm.minYoyGrowth) : null,
        maxRaisedM:   profForm.maxRaisedM != null ? Number(profForm.maxRaisedM) : null,
        minGdr:       profForm.minGdr != null ? Number(profForm.minGdr) : null,
        minNdr:       profForm.minNdr != null ? Number(profForm.minNdr) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.profile) {
      setProfile(data.profile);
      localStorage.setItem("dealfit_handle", data.profile.handle);
      setMyHandle(data.profile.handle);
    }
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  // Toggle interest
  const handleInterest = async (dealId: string) => {
    if (!myHandle) { setTab("profile"); return; }
    const res = await fetch("/api/dealfit/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, handle: myHandle }),
    });
    const data = await res.json().catch(() => ({}));
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const interests = data.interested
        ? [...d.interests, { handle: myHandle }]
        : d.interests.filter(i => i.handle !== myHandle);
      return { ...d, interests };
    }));
  };

  const handleDelete = async (dealId: string) => {
    await fetch(`/api/dealfit/deals?id=${dealId}`, { method: "DELETE" });
    setDeals(prev => prev.filter(d => d.id !== dealId));
  };

  // Filtered + sorted deals
  const filteredDeals = useMemo(() => {
    let list = deals.filter(d => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterVertical && d.vertical !== filterVertical) return false;
      if (filterStage && d.stage !== filterStage) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.codeName.toLowerCase().includes(q) && !d.vertical.toLowerCase().includes(q) &&
            !(d.description ?? "").toLowerCase().includes(q) && !(d.endMarket ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "arr") return (b.arrM ?? 0) - (a.arrM ?? 0);
      if (sortBy === "growth") return (b.yoyGrowth ?? 0) - (a.yoyGrowth ?? 0);
      if (sortBy === "fit") {
        const fa = computeFit(a, profile)?.score ?? -1;
        const fb = computeFit(b, profile)?.score ?? -1;
        return fb - fa;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [deals, filterStatus, filterVertical, filterStage, search, sortBy, profile]);

  const usedVerticals = useMemo(() => [...new Set(deals.map(d => d.vertical).filter(Boolean))].sort(), [deals]);
  const matchCount    = useMemo(() => {
    if (!profile) return 0;
    return deals.filter(d => { const f = computeFit(d, profile); return f && f.score >= 65; }).length;
  }, [deals, profile]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <Zap size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">DealFit</h1>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Beta</span>
          </div>
          <p className="text-sm text-slate-500">Anonymous cross-firm deal sharing. All companies shown under code names — no NDAs broken.</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Submit a Deal
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Deals",   value: String(deals.filter(d => d.status === "ACTIVE").length),  icon: <TrendingUp size={14} /> },
          { label: "Verticals",      value: String(usedVerticals.length),                              icon: <DollarSign size={14} /> },
          { label: "Investor Profiles", value: profile ? "1 (you)" : "—",                             icon: <Users size={14} /> },
          { label: "Deals Match",    value: profile ? `${matchCount} ≥ 65%` : "Set profile →",       icon: <Zap size={14} /> },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">{s.icon}<span className="text-[10px] uppercase tracking-wide font-semibold">{s.label}</span></div>
            <div className="text-sm font-bold text-slate-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["board", "profile"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t === "board" ? "Deal Board" : "My Investment Profile"}
          </button>
        ))}
      </div>

      {/* ── DEAL BOARD ─────────────────────────────────────────────────────── */}
      {tab === "board" && (
        <div className="space-y-4">
          {!profile && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Set your investment profile to see fit scores</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  <button onClick={() => setTab("profile")} className="underline font-semibold">Go to My Profile →</button>
                  {" "}to enter your criteria. Each deal will then show a match percentage.
                </p>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search deals…"
                className="pl-7 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
            </div>
            <select value={filterVertical} onChange={e => setFilterVertical(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-600">
              <option value="">All Verticals</option>
              {usedVerticals.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-600">
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-600">
              <option value="ACTIVE">Active</option>
              <option value="">All Status</option>
              <option value="CLOSED">Closed</option>
              <option value="MATCHED">Matched</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-600">
              <option value="date">Sort: Newest</option>
              <option value="arr">Sort: ARR</option>
              <option value="growth">Sort: Growth</option>
              {profile && <option value="fit">Sort: Best Fit</option>}
            </select>
            {(filterVertical || filterStage || search || filterStatus !== "ACTIVE") && (
              <button onClick={() => { setFilterVertical(""); setFilterStage(""); setSearch(""); setFilterStatus("ACTIVE"); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Deals grid */}
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Loading deals…</div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-500 font-medium">No deals match your filters</p>
              <p className="text-slate-400 text-sm mt-1">
                {deals.length === 0 ? "Be the first to submit a deal anonymously." : "Try adjusting your filters or clear them."}
              </p>
              {deals.length === 0 && (
                <button onClick={() => setShowSubmit(true)}
                  className="mt-4 text-sm text-blue-600 font-semibold hover:underline">
                  Submit the first deal →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDeals.map(d => (
                <DealCard key={d.id} deal={d} profile={profile} myHandle={myHandle}
                  onInterest={handleInterest} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MY PROFILE ─────────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Your profile is anonymous</p>
              <p className="text-xs text-amber-600 mt-0.5">Your handle is visible only to you. Investors expressed interest on deals are shown as a count only — no names revealed.</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {/* Handle */}
            <div>
              <FieldInput label="Your anonymous handle (firm code)" value={profForm.handle}
                onChange={v => setProfForm(p => ({ ...p, handle: v }))}
                placeholder="e.g. Acme Growth Fund, Fund A, GE Firm 1" />
              <p className="text-[11px] text-slate-400 mt-1">This persists in your browser so your preferences reload automatically.</p>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">ARR Range ($M)</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Min ARR" value={profForm.minArrM != null ? String(profForm.minArrM) : ""}
                  onChange={v => setProfForm(p => ({ ...p, minArrM: v === "" ? null : Number(v) }))}
                  prefix="$" suffix="M" placeholder="e.g. 3" />
                <NumberInput label="Max ARR" value={profForm.maxArrM != null ? String(profForm.maxArrM) : ""}
                  onChange={v => setProfForm(p => ({ ...p, maxArrM: v === "" ? null : Number(v) }))}
                  prefix="$" suffix="M" placeholder="e.g. 30" />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Growth & Retention Minimums</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Min YoY Growth" value={profForm.minYoyGrowth != null ? String(profForm.minYoyGrowth) : ""}
                  onChange={v => setProfForm(p => ({ ...p, minYoyGrowth: v === "" ? null : Number(v) }))}
                  suffix="%" placeholder="e.g. 50" />
                <NumberInput label="Min NDR" value={profForm.minNdr != null ? String(profForm.minNdr) : ""}
                  onChange={v => setProfForm(p => ({ ...p, minNdr: v === "" ? null : Number(v) }))}
                  suffix="%" placeholder="e.g. 110" />
                <NumberInput label="Min GDR (dealbreaker)" value={profForm.minGdr != null ? String(profForm.minGdr) : ""}
                  onChange={v => setProfForm(p => ({ ...p, minGdr: v === "" ? null : Number(v) }))}
                  suffix="%" placeholder="e.g. 85" />
                <NumberInput label="Max Total Raised" value={profForm.maxRaisedM != null ? String(profForm.maxRaisedM) : ""}
                  onChange={v => setProfForm(p => ({ ...p, maxRaisedM: v === "" ? null : Number(v) }))}
                  prefix="$" suffix="M" placeholder="e.g. 25" />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verticals of Interest</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VERTICALS.map(v => (
                  <button key={v} onClick={() => toggleVert(v)}
                    className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                      profVerts.includes(v)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}>
                    {profVerts.includes(v) ? <Check size={11} className="shrink-0" /> : <div className="w-[11px]" />}
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Other Notes / Criteria</label>
                <textarea value={profForm.notes ?? ""}
                  onChange={e => setProfForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Prefer founder-led, no sponsor-backed, SaaS only…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder:text-slate-300" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <Check size={14} /> Profile saved — fit scores updated
                </span>
              )}
              {!profileSaved && <div />}
              <button onClick={handleSaveProfile} disabled={savingProfile || !profForm.handle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT DEAL MODAL ───────────────────────────────────────────────── */}
      {showSubmit && (
        <Modal title="Submit an Anonymous Deal" onClose={() => setShowSubmit(false)}>
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2">
              <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">Company identity stays private. Only a code name and metrics are shared — no company name, no URL, no team details.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex gap-3 items-end">
                <div className="flex-1">
                  <FieldInput label='Code name (or leave blank to auto-generate)'
                    value={dealForm.codeName} onChange={setDF("codeName")}
                    placeholder="e.g. Project Aurora" />
                </div>
                <button type="button"
                  onClick={() => setDealForm(p => ({ ...p, codeName: CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)] }))}
                  className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 px-3 py-2.5 rounded-xl hover:bg-slate-50 mb-0 whitespace-nowrap">
                  <Shuffle size={12} /> Random
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Vertical <span className="text-red-400">*</span></label>
                <select value={dealForm.vertical} onChange={e => setDF("vertical")(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select vertical…</option>
                  {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <FieldInput label="End Market / Niche" value={dealForm.endMarket} onChange={setDF("endMarket")} placeholder="e.g. Commercial HVAC contractors" />

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Stage</label>
                <select value={dealForm.stage} onChange={e => setDF("stage")(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select stage…</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Anonymous Description</label>
                <textarea value={dealForm.description} onChange={e => setDF("description")(e.target.value)}
                  rows={2} placeholder="What do they do, who do they serve, what makes them differentiated — no identifying details"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder:text-slate-300" />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Metrics (all optional)</p>
              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="ARR ($M)"            value={dealForm.arrM}          onChange={setDF("arrM")}         prefix="$" suffix="M" />
                <NumberInput label="YoY Growth"          value={dealForm.yoyGrowth}     onChange={setDF("yoyGrowth")}    suffix="%" />
                <NumberInput label="Total Raised ($M)"   value={dealForm.totalRaisedM}  onChange={setDF("totalRaisedM")} prefix="$" suffix="M" />
                <NumberInput label="NDR"                 value={dealForm.ndr}           onChange={setDF("ndr")}          suffix="%" />
                <NumberInput label="GDR"                 value={dealForm.gdr}           onChange={setDF("gdr")}          suffix="%" />
                <NumberInput label="ACV ($K)"            value={dealForm.acvK}          onChange={setDF("acvK")}         prefix="$" suffix="K" />
                <NumberInput label="LTM EBITDA ($M)"     value={dealForm.ltmEbitdaM}    onChange={setDF("ltmEbitdaM")}   prefix="$" suffix="M" placeholder="neg = burn" />
                <NumberInput label="Customers"           value={dealForm.customerCount} onChange={setDF("customerCount")} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setShowSubmit(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitDeal} disabled={submitting || !dealForm.vertical}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                {submitting ? "Submitting…" : "Submit Deal"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
