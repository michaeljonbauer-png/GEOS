"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, X, Check, Search, Zap,
  Heart, AlertCircle, Info, Trash2, Users, TrendingUp, DollarSign, Star,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deal {
  id: string; seqNum: number; submittedBy?: string | null;
  codeName: string; vertical: string; endMarket?: string | null;
  description?: string | null; stage?: string | null;
  arrM?: number | null; yoyGrowth?: number | null; totalRaisedM?: number | null;
  ndr?: number | null; gdr?: number | null; ltmEbitdaM?: number | null;
  customerCount?: number | null; acvK?: number | null;
  status: string; createdAt: string;
  interests: { handle: string }[];
  ratings: { handle: string; rating: number }[];
}

interface Profile {
  id?: string; handle: string;
  minArrM?: number | null; maxArrM?: number | null;
  minYoyGrowth?: number | null; maxRaisedM?: number | null;
  minGdr?: number | null; minNdr?: number | null;
  verticals: string; notes?: string | null;
}

type FitColor = "emerald" | "blue" | "amber" | "slate" | "red";
interface FitResult { score: number; label: string; color: FitColor; }

// ── Constants ─────────────────────────────────────────────────────────────────

const VERTICALS = [
  "FinTech", "HealthTech / MedTech", "EdTech", "MarTech / AdTech",
  "DevTools / DevOps", "Supply Chain / Logistics", "Construction Tech",
  "Manufacturing / Industrial", "AgTech", "PropTech", "HR Tech", "Legal Tech",
  "Cybersecurity", "Data & Analytics", "AI / ML Platform", "ERP / ERP Adjacent",
  "Field Service", "Insurance Tech", "GovTech", "Consumer", "Other",
];
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Growth"];
const STATUSES = ["ACTIVE", "CLOSED", "MATCHED"] as const;
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

  if (profile.minArrM && deal.arrM != null && deal.arrM < profile.minArrM)
    return { score: 0, label: "Below ARR Min", color: "red" };
  if (profile.maxArrM && deal.arrM != null && deal.arrM > profile.maxArrM)
    return { score: 0, label: "Above ARR Max", color: "red" };
  if (profile.maxRaisedM && deal.totalRaisedM != null && deal.totalRaisedM > profile.maxRaisedM)
    return { score: 0, label: "Over-capitalized", color: "red" };
  if (profile.minGdr && deal.gdr != null && deal.gdr < profile.minGdr)
    return { score: 0, label: "GDR too low", color: "red" };

  let pts = 0, maxPts = 0;
  if (verts.length > 0) { maxPts += 35; if (verts.includes(deal.vertical)) pts += 35; }
  if (profile.minYoyGrowth != null && deal.yoyGrowth != null) {
    maxPts += 25;
    pts += deal.yoyGrowth >= profile.minYoyGrowth ? 25 : Math.max(0, Math.round(25 * deal.yoyGrowth / profile.minYoyGrowth));
  }
  if (profile.minNdr != null && deal.ndr != null) {
    maxPts += 25;
    pts += deal.ndr >= profile.minNdr ? 25 : Math.max(0, Math.round(25 * deal.ndr / profile.minNdr));
  }
  if ((profile.minArrM || profile.maxArrM) && deal.arrM != null) {
    maxPts += 15;
    const ok = (!profile.minArrM || deal.arrM >= profile.minArrM) && (!profile.maxArrM || deal.arrM <= profile.maxArrM);
    if (ok) pts += 15;
  }
  if (maxPts === 0) return null;

  const score = Math.min(100, Math.round((pts / maxPts) * 100));
  const label = score >= 85 ? "Strong" : score >= 65 ? "Good" : score >= 40 ? "Partial" : "Weak";
  const color: FitColor = score >= 85 ? "emerald" : score >= 65 ? "blue" : score >= 40 ? "amber" : "slate";
  return { score, label, color };
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtM = (v: number | null | undefined) => v == null ? "" : `$${v % 1 === 0 ? v : v.toFixed(1)}M`;
const fmtPct = (v: number | null | undefined) => v == null ? "" : `${v}%`;
const fmtK = (v: number | null | undefined) => v == null ? "" : `$${v % 1 === 0 ? v : v.toFixed(0)}K`;
const fmtCount = (v: number | null | undefined) => v == null ? "" : String(v);
const daysAgo = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
};

// ── Profile form helpers ──────────────────────────────────────────────────────

function NumberInput({ label, value, onChange, prefix, suffix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
        {prefix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200">{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="flex-1 px-3 py-2 text-sm focus:outline-none" />
        {suffix && <span className="px-2 text-xs text-slate-400 bg-slate-50 border-l border-slate-200">{suffix}</span>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Status badge (cycles on click) ────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  ACTIVE:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  CLOSED:  "bg-slate-100 text-slate-500 border-slate-200",
  MATCHED: "bg-blue-100 text-blue-700 border-blue-200",
};
const FIT_CLS: Record<FitColor, string> = {
  emerald: "text-emerald-600", blue: "text-blue-600",
  amber: "text-amber-600", slate: "text-slate-400", red: "text-red-500",
};

// ── Inline cell components ────────────────────────────────────────────────────

const NUM_FIELDS = ["arrM","yoyGrowth","totalRaisedM","ndr","gdr","ltmEbitdaM","acvK","customerCount"];

interface CellProps {
  id: string; field: string;
  editCell: { id: string; field: string } | null;
  draft: string;
  setDraft: (v: string) => void;
  onStart: (id: string, field: string, raw: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function CellText({ id, field, value, placeholder, editCell, draft, setDraft, onStart, onSave, onCancel }: CellProps & { value: string | null | undefined; placeholder?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editCell?.id === id && editCell?.field === field;
  useEffect(() => { if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [isEditing]);

  if (isEditing) return (
    <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={onSave}
      onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
      className="w-full bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none min-w-[80px]" />
  );
  return (
    <div onClick={() => onStart(id, field, value ?? "")}
      className="cursor-text px-1.5 py-1 rounded hover:bg-slate-100 min-h-[26px] text-xs">
      {value || <span className="text-slate-300">{placeholder ?? "—"}</span>}
    </div>
  );
}

function CellNum({ id, field, value, fmt, editCell, draft, setDraft, onStart, onSave, onCancel }: CellProps & { value: number | null | undefined; fmt: (v: number | null | undefined) => string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editCell?.id === id && editCell?.field === field;
  useEffect(() => { if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [isEditing]);

  if (isEditing) return (
    <input ref={inputRef} type="number" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={onSave}
      onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
      className="w-full bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none min-w-[60px] text-right" />
  );
  return (
    <div onClick={() => onStart(id, field, value != null ? String(value) : "")}
      className="cursor-text px-1.5 py-1 rounded hover:bg-slate-100 min-h-[26px] text-xs text-right tabular-nums">
      {value != null ? fmt(value) : <span className="text-slate-300">—</span>}
    </div>
  );
}

function CellSelect({ id, field, value, options, editCell, draft, setDraft, onStart, onSave, onCancel }: CellProps & { value: string | null | undefined; options: readonly string[] }) {
  const selRef = useRef<HTMLSelectElement>(null);
  const isEditing = editCell?.id === id && editCell?.field === field;
  useEffect(() => { if (isEditing) selRef.current?.focus(); }, [isEditing]);

  if (isEditing) return (
    <select ref={selRef} value={draft} onChange={e => { setDraft(e.target.value); onSave(); }}
      onBlur={onSave}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
      className="w-full bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none min-w-[100px]">
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div onClick={() => onStart(id, field, value ?? "")}
      className="cursor-pointer px-1.5 py-1 rounded hover:bg-slate-100 min-h-[26px] text-xs">
      {value || <span className="text-slate-300">—</span>}
    </div>
  );
}

// ── Star Rating Cell ──────────────────────────────────────────────────────────

function RatingCell({ deal, myHandle, onRate }: {
  deal: Deal; myHandle: string;
  onRate: (dealId: string, rating: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const myRating = deal.ratings.find(r => r.handle === myHandle)?.rating ?? 0;
  const count    = deal.ratings.length;
  const avg      = count > 0
    ? deal.ratings.reduce((s, r) => s + r.rating, 0) / count
    : null;

  const activeStar = hover > 0 ? hover : myRating;

  const handleClick = (star: number) => {
    if (!myHandle) return;
    onRate(deal.id, star === myRating ? 0 : star); // re-click clears rating
  };

  return (
    <div
      className="flex flex-col items-center gap-0.5 py-0.5 px-1 select-none"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHover(0); }}
    >
      {/* 5 stars */}
      <div className="flex gap-px">
        {[1, 2, 3, 4, 5].map(star => {
          const filled = isHovering ? star <= activeStar : avg != null && star <= Math.round(avg);
          const isMyRating = !isHovering && star === myRating;
          return (
            <button
              key={star}
              disabled={!myHandle}
              onMouseEnter={() => myHandle && setHover(star)}
              onClick={() => handleClick(star)}
              className={`text-[11px] leading-none transition-colors ${
                isMyRating   ? "text-amber-500" :
                filled       ? "text-amber-300" :
                               "text-slate-200"
              } ${myHandle ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
            >★</button>
          );
        })}
      </div>
      {/* Avg / prompt */}
      <span className="text-[9px] leading-none tabular-nums text-slate-400">
        {avg != null
          ? `${avg.toFixed(1)} · ${count}`
          : myHandle ? <span className="text-slate-300">rate</span> : "—"}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DealFitPage() {
  const [tab, setTab]       = useState<"board" | "profile">("board");
  const [deals, setDeals]   = useState<Deal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [newDealId, setNewDealId]         = useState<string | null>(null);

  // Filters
  const [search, setSearch]                 = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [filterStage, setFilterStage]       = useState("");
  const [filterStatus, setFilterStatus]     = useState("ACTIVE");

  // Profile form
  const [profForm, setProfForm] = useState({ ...BLANK_PROFILE, verticals: "[]" });
  const profVerts: string[] = useMemo(() => { try { return JSON.parse(profForm.verticals); } catch { return []; } }, [profForm.verticals]);
  const toggleVert = (v: string) => {
    const next = profVerts.includes(v) ? profVerts.filter(x => x !== v) : [...profVerts, v];
    setProfForm(p => ({ ...p, verticals: JSON.stringify(next) }));
  };

  // My handle
  const [myHandle, setMyHandle] = useState("");
  useEffect(() => {
    const h = localStorage.getItem("dealfit_handle") ?? "";
    setMyHandle(h);
    if (h) setProfForm(p => ({ ...p, handle: h }));
  }, []);

  // Inline editing
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null);
  const [draft, setDraft]       = useState("");

  const startEdit = useCallback((id: string, field: string, raw: string) => {
    setEditCell({ id, field });
    setDraft(raw);
  }, []);

  const saveCellEdit = useCallback(async () => {
    if (!editCell) return;
    const { id, field } = editCell;
    setEditCell(null);

    const value = NUM_FIELDS.includes(field)
      ? (draft.trim() === "" ? null : Number(draft))
      : (draft.trim() || null);

    setDeals(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    await fetch("/api/dealfit/deals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
  }, [editCell, draft]);

  const cancelEdit = useCallback(() => { setEditCell(null); setDraft(""); }, []);

  // Shared cell props
  const cp = { editCell, draft, setDraft, onStart: startEdit, onSave: saveCellEdit, onCancel: cancelEdit };

  // Load data
  const loadDeals = async () => {
    const res  = await fetch("/api/dealfit/deals");
    const data = await res.json().catch(() => ({}));
    setDeals(data.deals ?? []);
    setLoading(false);
  };
  const loadProfile = async (handle: string) => {
    if (!handle) return;
    const res  = await fetch(`/api/dealfit/profile?handle=${encodeURIComponent(handle)}`);
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

  // Add new deal opp (creates row, then edit inline)
  const handleAddDeal = async () => {
    const codeName = CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)];
    const res  = await fetch("/api/dealfit/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeName, vertical: "", submittedBy: myHandle || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.deal) {
      const newDeal = { ...data.deal, interests: [], ratings: [] } as Deal;
      setDeals(prev => [...prev, newDeal]); // append (table sorted asc by seqNum)
      setNewDealId(data.deal.id);
      setTimeout(() => setNewDealId(null), 3000);
      setFilterStatus(""); // show all so new row is visible
      startEdit(data.deal.id, "vertical", "");
    }
  };

  // Rate a deal (1–5, or 0 to clear)
  const handleRate = async (dealId: string, rating: number) => {
    if (!myHandle) { setTab("profile"); return; }
    // Optimistic update
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const others = d.ratings.filter(r => r.handle !== myHandle);
      const ratings = rating === 0 ? others : [...others, { handle: myHandle, rating }];
      return { ...d, ratings };
    }));
    await fetch("/api/dealfit/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, handle: myHandle, rating }),
    });
  };

  // Cycle status on click
  const cycleStatus = async (deal: Deal) => {
    const next = STATUSES[(STATUSES.indexOf(deal.status as typeof STATUSES[number]) + 1) % STATUSES.length];
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, status: next } : d));
    await fetch("/api/dealfit/deals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deal.id, status: next }),
    });
  };

  // Toggle interest
  const handleInterest = async (dealId: string) => {
    if (!myHandle) { setTab("profile"); return; }
    const res  = await fetch("/api/dealfit/interest", {
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

  // Delete
  const handleDelete = async (dealId: string) => {
    setDeals(prev => prev.filter(d => d.id !== dealId));
    await fetch(`/api/dealfit/deals?id=${dealId}`, { method: "DELETE" });
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!profForm.handle.trim()) return;
    setSavingProfile(true);
    const res  = await fetch("/api/dealfit/profile", {
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

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterVertical && d.vertical !== filterVertical) return false;
      if (filterStage && d.stage !== filterStage) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.codeName.toLowerCase().includes(q) &&
            !d.vertical.toLowerCase().includes(q) &&
            !(d.description ?? "").toLowerCase().includes(q) &&
            !(d.endMarket ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [deals, filterStatus, filterVertical, filterStage, search]);

  const usedVerticals = useMemo(() => [...new Set(deals.map(d => d.vertical).filter(Boolean))].sort(), [deals]);
  const matchCount    = useMemo(() => {
    if (!profile) return 0;
    return deals.filter(d => { const f = computeFit(d, profile); return f && f.score >= 65; }).length;
  }, [deals, profile]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-5">

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
          <p className="text-sm text-slate-500">Anonymous cross-firm deal sharing. All companies shown under code names.</p>
        </div>
        <button
          onClick={handleAddDeal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Add a Deal Opp
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Deals",      value: String(deals.filter(d => d.status === "ACTIVE").length), icon: <TrendingUp size={14} /> },
          { label: "Verticals",         value: String(usedVerticals.length),                             icon: <DollarSign size={14} /> },
          { label: "Your Profile",      value: profile ? "Set" : "Not set",                             icon: <Users size={14} /> },
          { label: "Deals ≥ 65% Fit",  value: profile ? String(matchCount) : "—",                      icon: <Zap size={14} /> },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              {s.icon}<span className="text-[10px] uppercase tracking-wide font-semibold">{s.label}</span>
            </div>
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
        <div className="space-y-3">
          {!profile && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                <button onClick={() => setTab("profile")} className="font-semibold underline">Set your investment profile</button>
                {" "}to see a fit % column for each deal.
              </p>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-7 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 w-36" />
            </div>
            <select value={filterVertical} onChange={e => setFilterVertical(e.target.value)}
              className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none text-slate-600">
              <option value="">All Verticals</option>
              {usedVerticals.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
              className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none text-slate-600">
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none text-slate-600">
              <option value="ACTIVE">Active only</option>
              <option value="">All Status</option>
              <option value="CLOSED">Closed</option>
              <option value="MATCHED">Matched</option>
            </select>
            {(filterVertical || filterStage || search || filterStatus !== "ACTIVE") && (
              <button onClick={() => { setFilterVertical(""); setFilterStage(""); setSearch(""); setFilterStatus("ACTIVE"); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={11} /> Clear
              </button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Spreadsheet table */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
              <p className="text-slate-500 font-medium text-sm">
                {deals.length === 0 ? "No deal opps yet." : "No deals match your filters."}
              </p>
              {deals.length === 0 && (
                <button onClick={handleAddDeal} className="mt-3 text-sm text-blue-600 font-semibold hover:underline">
                  Add the first deal opp →
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {[
                      { label: "#",            cls: "w-[36px]  min-w-[30px] text-right" },
                      { label: "Code Name",    cls: "w-[120px] min-w-[100px]" },
                      { label: "By",           cls: "w-[90px]  min-w-[70px]" },
                      { label: "Vertical",     cls: "w-[130px] min-w-[110px]" },
                      { label: "End Market",   cls: "w-[110px] min-w-[90px]" },
                      { label: "Stage",        cls: "w-[90px]  min-w-[80px]" },
                      { label: "ARR",          cls: "w-[65px]  min-w-[55px] text-right" },
                      { label: "YoY Gr%",      cls: "w-[60px]  min-w-[50px] text-right" },
                      { label: "Raised",       cls: "w-[65px]  min-w-[55px] text-right" },
                      { label: "NDR%",         cls: "w-[55px]  min-w-[45px] text-right" },
                      { label: "GDR%",         cls: "w-[55px]  min-w-[45px] text-right" },
                      { label: "EBITDA",       cls: "w-[65px]  min-w-[55px] text-right" },
                      { label: "Cust.",        cls: "w-[50px]  min-w-[40px] text-right" },
                      { label: "ACV",          cls: "w-[60px]  min-w-[50px] text-right" },
                      { label: "Description",  cls: "w-[150px] min-w-[110px]" },
                      { label: "Status",       cls: "w-[75px]  min-w-[65px]" },
                      { label: "Rating",       cls: "w-[80px]  min-w-[70px] text-center" },
                      ...(profile ? [{ label: "Fit", cls: "w-[50px] min-w-[44px] text-right" }] : []),
                      { label: "🤍",           cls: "w-[44px]  min-w-[36px] text-center" },
                      { label: "Added",        cls: "w-[60px]  min-w-[50px] text-right" },
                      { label: "",             cls: "w-[28px]" },
                    ].map((h, i) => (
                      <th key={i} className={`px-2 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] select-none ${h.cls}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal, idx) => {
                    const fit   = computeFit(deal, profile);
                    const iAmIn = deal.interests.some(i => i.handle === myHandle);
                    const isNew = deal.id === newDealId;
                    return (
                      <tr key={deal.id}
                        className={`border-b border-slate-100 group transition-colors ${
                          isNew ? "bg-blue-50/60" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        } hover:bg-blue-50/30`}>

                        {/* # */}
                        <td className="px-2 py-0.5 text-right text-[11px] font-mono text-slate-400 select-none">
                          {deal.seqNum}
                        </td>

                        {/* Code Name */}
                        <td className="px-1 py-0.5">
                          <CellText id={deal.id} field="codeName" value={deal.codeName} {...cp} />
                        </td>

                        {/* Submitted By */}
                        <td className="px-2 py-0.5">
                          {deal.submittedBy
                            ? <span className="text-[11px] text-slate-500 truncate block max-w-[80px]" title={deal.submittedBy}>{deal.submittedBy}</span>
                            : <span className="text-slate-200 text-[11px]">—</span>}
                        </td>

                        {/* Vertical */}
                        <td className="px-1 py-0.5">
                          <CellSelect id={deal.id} field="vertical" value={deal.vertical} options={VERTICALS} {...cp} />
                        </td>

                        {/* End Market */}
                        <td className="px-1 py-0.5">
                          <CellText id={deal.id} field="endMarket" value={deal.endMarket} placeholder="—" {...cp} />
                        </td>

                        {/* Stage */}
                        <td className="px-1 py-0.5">
                          <CellSelect id={deal.id} field="stage" value={deal.stage} options={STAGES} {...cp} />
                        </td>

                        {/* ARR */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="arrM" value={deal.arrM} fmt={fmtM} {...cp} />
                        </td>

                        {/* YoY Growth */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="yoyGrowth" value={deal.yoyGrowth} fmt={fmtPct} {...cp} />
                        </td>

                        {/* Total Raised */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="totalRaisedM" value={deal.totalRaisedM} fmt={fmtM} {...cp} />
                        </td>

                        {/* NDR */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="ndr" value={deal.ndr} fmt={fmtPct} {...cp} />
                        </td>

                        {/* GDR */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="gdr" value={deal.gdr} fmt={fmtPct} {...cp} />
                        </td>

                        {/* LTM EBITDA */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="ltmEbitdaM" value={deal.ltmEbitdaM} fmt={v => v == null ? "" : v < 0 ? `(${fmtM(Math.abs(v)).replace("$","($")}` : fmtM(v)} {...cp} />
                        </td>

                        {/* Customers */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="customerCount" value={deal.customerCount} fmt={fmtCount} {...cp} />
                        </td>

                        {/* ACV */}
                        <td className="px-1 py-0.5">
                          <CellNum id={deal.id} field="acvK" value={deal.acvK} fmt={fmtK} {...cp} />
                        </td>

                        {/* Description */}
                        <td className="px-1 py-0.5">
                          <CellText id={deal.id} field="description" value={deal.description} placeholder="—" {...cp} />
                        </td>

                        {/* Status */}
                        <td className="px-1 py-0.5">
                          <button onClick={() => cycleStatus(deal)} title="Click to cycle status"
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-opacity hover:opacity-75 ${STATUS_CLS[deal.status] ?? STATUS_CLS.ACTIVE}`}>
                            {deal.status}
                          </button>
                        </td>

                        {/* Rating */}
                        <td className="px-0 py-0.5">
                          <RatingCell deal={deal} myHandle={myHandle} onRate={handleRate} />
                        </td>

                        {/* Fit score */}
                        {profile && (
                          <td className="px-2 py-0.5 text-right">
                            {fit ? (
                              <span className={`font-bold tabular-nums ${FIT_CLS[fit.color]}`}>
                                {fit.score}%
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}

                        {/* Interest */}
                        <td className="px-1 py-0.5 text-center">
                          <button onClick={() => handleInterest(deal.id)}
                            className={`flex items-center gap-0.5 mx-auto text-[11px] transition-colors ${
                              iAmIn ? "text-rose-500" : "text-slate-300 hover:text-rose-400"
                            }`}
                            title={iAmIn ? "Remove interest" : "Express interest (anonymous)"}>
                            <Heart size={12} fill={iAmIn ? "currentColor" : "none"} />
                            {deal.interests.length > 0 && <span>{deal.interests.length}</span>}
                          </button>
                        </td>

                        {/* Added */}
                        <td className="px-2 py-0.5 text-right text-slate-300 whitespace-nowrap">
                          {daysAgo(deal.createdAt)}
                        </td>

                        {/* Delete */}
                        <td className="px-1 py-0.5 text-center">
                          <button onClick={() => handleDelete(deal.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5 rounded"
                            title="Delete deal">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Add row footer */}
              <button onClick={handleAddDeal}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border-t border-slate-100">
                <Plus size={12} /> Add a Deal Opp
              </button>
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
              <p className="text-xs text-amber-600 mt-0.5">Your handle is visible only to you. Interest on deals shows as a count only — no names revealed.</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {/* Handle */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Your anonymous handle (firm code)</label>
              <input type="text" value={profForm.handle}
                onChange={e => setProfForm(p => ({ ...p, handle: e.target.value }))}
                placeholder="e.g. Acme Growth Fund, Fund A, GE Firm 1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-300" />
              <p className="text-[11px] text-slate-400 mt-1">Persists in your browser so preferences reload automatically.</p>
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
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Other Notes / Criteria</label>
              <textarea value={profForm.notes ?? ""}
                onChange={e => setProfForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Prefer founder-led, no sponsor-backed, SaaS only…"
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder:text-slate-300" />
            </div>

            <div className="flex items-center justify-between pt-2">
              {profileSaved ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <Check size={14} /> Saved — fit scores updated
                </span>
              ) : <div />}
              <button onClick={handleSaveProfile} disabled={savingProfile || !profForm.handle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
