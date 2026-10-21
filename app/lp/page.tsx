"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Landmark, Users, FileText, TrendingUp, ArrowRight, Calculator, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LPContact { id: string; name: string; firm: string | null; commitment: number | null; type: string }
interface LPUpdate { id: string; period: string; title: string; status: string; sentAt: string | null; createdAt: string }
interface Snapshot { numCompanies: number; totalDeployed: number; totalCurrentVal: number; tvpi: number | null }

const TYPE_LABEL: Record<string, string> = { LP: "LP", CO_INVESTOR: "Co-investor", ADVISOR: "Advisor" };

const money = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(1)}M`);

export default function LPDashboard() {
  const [contacts, setContacts] = useState<LPContact[]>([]);
  const [updates, setUpdates] = useState<LPUpdate[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/lp/contacts").then((r) => r.json()).catch(() => []),
      fetch("/api/lp/updates").then((r) => r.json()).catch(() => []),
      fetch("/api/lp/portfolio-snapshot").then((r) => r.json()).catch(() => null),
    ])
      .then(([c, u, s]) => { setContacts(c); setUpdates(u); setSnap(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>;

  const lps = contacts.filter((c) => c.type === "LP");
  const coInvestors = contacts.filter((c) => c.type === "CO_INVESTOR");
  const committed = lps.reduce((s, c) => s + (c.commitment ?? 0), 0);
  const lastSent = updates.filter((u) => u.status === "SENT").sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))[0];
  const drafts = updates.filter((u) => u.status !== "SENT").length;
  const topLps = [...contacts].sort((a, b) => (b.commitment ?? 0) - (a.commitment ?? 0)).slice(0, 8);

  const stats = [
    { label: "LP commitments", value: committed ? money(committed) : "—", sub: `${lps.length} LP${lps.length === 1 ? "" : "s"}`, icon: Landmark, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Co-investors", value: coInvestors.length, sub: `${contacts.length} relationships total`, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Last memo sent", value: lastSent ? lastSent.period : "—", sub: lastSent ? format(new Date(lastSent.sentAt ?? lastSent.createdAt), "MMM d, yyyy") : "No memos sent yet", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Portfolio TVPI", value: snap?.tvpi ? `${snap.tvpi.toFixed(2)}×` : "—", sub: snap?.numCompanies ? `${snap.numCompanies} PortCo${snap.numCompanies === 1 ? "" : "s"}` : "No PortCos yet", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LP Fundraising & Comms</h1>
          <p className="text-slate-500 text-sm mt-1">Your LP base, quarterly update memos and fund economics</p>
        </div>
        <div className="flex gap-2">
          <Link href="/fund-model"><Button variant="outline" size="sm"><Calculator size={14} /> GP Fund Model</Button></Link>
          <Link href="/lp-reporting"><Button size="sm"><Plus size={14} /> New LP memo</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 truncate">{value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                </div>
                <div className={`rounded-xl p-3 shrink-0 ${bg}`}><Icon className={color} size={22} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">LP update memos {drafts > 0 && <span className="text-xs font-normal text-amber-600 ml-1">{drafts} draft{drafts === 1 ? "" : "s"}</span>}</CardTitle>
              <Link href="/lp-reporting" className="text-xs text-blue-600 hover:underline flex items-center gap-1">All memos <ArrowRight size={12} /></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {updates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No memos yet. <Link href="/lp-reporting" className="text-blue-600 hover:underline">Draft your first quarterly update</Link> — it pre-fills with live portfolio numbers.
              </p>
            ) : updates.slice(0, 8).map((u) => (
              <Link key={u.id} href={`/lp-reporting?update=${u.id}`}>
                <div className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.title}</p>
                    <p className="text-xs text-slate-400">{u.period} · {format(new Date(u.sentAt ?? u.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${u.status === "SENT" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {u.status === "SENT" ? "Sent" : "Draft"}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">LP base</CardTitle>
                <Link href="/lp-reporting?tab=contacts" className="text-xs text-blue-600 hover:underline flex items-center gap-1">Manage <ArrowRight size={12} /></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {topLps.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No LPs added yet</p>
              ) : topLps.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">{[c.firm, TYPE_LABEL[c.type] ?? c.type].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 shrink-0">{c.commitment ? money(c.commitment) : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Portfolio snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!snap || snap.numCompanies === 0 ? (
                <p className="text-sm text-slate-400">No PortCos yet — numbers appear once companies are marked Invested (PortCo).</p>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">PortCos</span><span className="font-semibold">{snap.numCompanies}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Capital deployed</span><span className="font-semibold">{snap.totalDeployed ? money(snap.totalDeployed) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Current value</span><span className="font-semibold">{snap.totalCurrentVal ? money(snap.totalCurrentVal) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">TVPI</span><span className="font-semibold">{snap.tvpi ? `${snap.tvpi.toFixed(2)}×` : "—"}</span></div>
                  <Link href="/portfolio" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 pt-1">Portfolio Monitoring <ArrowRight size={12} /></Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
