"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Briefcase, ListChecks, FileSpreadsheet, Gavel, ArrowRight, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStatusConfig, getPriorityConfig, formatARR } from "@/lib/utils";

interface Deal {
  id: string;
  name: string;
  status: string;
  priority: string;
  sector: string | null;
  arrEstimate: number | null;
  diligenceTasks: { status: string }[];
  dealTerms: { name: string; value: string | null }[];
  contacts: { firstName: string; lastName: string; title: string | null }[];
}

interface Underwrite {
  id: string;
  status: string;
  analystName: string | null;
  createdAt: string;
  company: { id: string; name: string; sector: string | null };
}

const UW_STATUS: Record<string, { label: string; color: string }> = {
  SCREENING:    { label: "Screening",    color: "bg-slate-100 text-slate-700" },
  IN_ANALYSIS:  { label: "In Analysis",  color: "bg-blue-100 text-blue-700" },
  READY_FOR_IC: { label: "Ready for IC", color: "bg-emerald-100 text-emerald-700" },
  PASSED:       { label: "Passed",       color: "bg-red-100 text-red-700" },
};

const KEY_TERMS = ["Pre-money Valuation ($M)", "Investment Amount ($M)", "Ownership % (Post-money)"];

export default function DealExecutionDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [underwrites, setUnderwrites] = useState<Underwrite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/deals/active").then((r) => r.json()).catch(() => []),
      fetch("/api/underwrite").then((r) => r.json()).catch(() => []),
    ])
      .then(([d, u]) => { setDeals(d); setUnderwrites(u); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>;

  const allTasks = deals.flatMap((d) => d.diligenceTasks);
  const tasksDone = allTasks.filter((t) => t.status === "DONE").length;
  const tasksBlocked = allTasks.filter((t) => t.status === "BLOCKED").length;
  const activeUw = underwrites.filter((u) => u.status === "SCREENING" || u.status === "IN_ANALYSIS").length;
  const readyForIc = underwrites.filter((u) => u.status === "READY_FOR_IC").length;
  const latestUwByCompany = new Map<string, Underwrite>();
  underwrites.forEach((u) => { if (!latestUwByCompany.has(u.company.id)) latestUwByCompany.set(u.company.id, u); });

  const stats = [
    { label: "Live deals", value: deals.length, icon: Briefcase, color: "text-indigo-600", bg: "bg-indigo-50" },
    {
      label: "Diligence done",
      value: allTasks.length ? `${Math.round((tasksDone / allTasks.length) * 100)}%` : "—",
      sub: allTasks.length ? `${tasksDone} of ${allTasks.length} tasks${tasksBlocked ? ` · ${tasksBlocked} blocked` : ""}` : "No tasks yet",
      icon: ListChecks, color: "text-emerald-600", bg: "bg-emerald-50",
    },
    { label: "Underwrites in progress", value: activeUw, icon: FileSpreadsheet, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Ready for IC", value: readyForIc, icon: Gavel, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deal Execution</h1>
          <p className="text-slate-500 text-sm mt-1">Live deals in diligence, deal terms and underwriting</p>
        </div>
        <div className="flex gap-2">
          <Link href="/live-deal"><Button variant="outline" size="sm"><ListChecks size={14} /> Diligence workspace</Button></Link>
          <Link href="/underwrite"><Button size="sm"><Plus size={14} /> New underwrite</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{value}</p>
                  {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                </div>
                <div className={`rounded-xl p-3 shrink-0 ${bg}`}><Icon className={color} size={22} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Live deals */}
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live deals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deals.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No live deals. Move a company to <strong>Offer Submitted</strong> or <strong>In Due Diligence</strong> on the{" "}
                <Link href="/pipeline" className="text-blue-600 hover:underline">Pipeline</Link> to start one.
              </p>
            ) : deals.map((d) => {
              const done = d.diligenceTasks.filter((t) => t.status === "DONE").length;
              const blocked = d.diligenceTasks.filter((t) => t.status === "BLOCKED").length;
              const total = d.diligenceTasks.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const filledTerms = d.dealTerms.filter((t) => t.value?.trim());
              const keyTerms = KEY_TERMS
                .map((name) => d.dealTerms.find((t) => t.name === name && t.value?.trim()))
                .filter((t): t is { name: string; value: string } => !!t);
              const uw = latestUwByCompany.get(d.id);
              const contact = d.contacts[0];
              const p = getPriorityConfig(d.priority);
              return (
                <div key={d.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/companies/${d.id}`} className="font-semibold text-slate-900 hover:text-blue-600">{d.name}</Link>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getStatusConfig(d.status).color}`}>{getStatusConfig(d.status).label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[d.sector, d.arrEstimate != null ? `${formatARR(d.arrEstimate)} ARR` : null, contact ? `${contact.firstName} ${contact.lastName}${contact.title ? `, ${contact.title}` : ""}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Link href={`/live-deal?deal=${d.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">Open workspace <ArrowRight size={12} /></Button>
                    </Link>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Diligence</span>
                      <span className="text-slate-600">
                        {total ? `${done}/${total} done` : "No checklist yet"}
                        {blocked > 0 && <span className="text-red-500 ml-1.5 inline-flex items-center gap-0.5"><AlertCircle size={11} /> {blocked} blocked</span>}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {keyTerms.length > 0 ? keyTerms.map((t) => (
                      <span key={t.name}>{t.name.replace(/ \(.*\)$/, "")}: <strong className="text-slate-700">{t.value}</strong></span>
                    )) : (
                      <span>{filledTerms.length ? `${filledTerms.length} terms filled in` : "No terms entered yet"}</span>
                    )}
                    <span className="ml-auto">
                      {uw ? (
                        <Link href={`/underwrite/${uw.id}`} className="text-blue-600 hover:underline">Underwrite: {UW_STATUS[uw.status]?.label ?? uw.status}</Link>
                      ) : (
                        <Link href="/underwrite" className="text-slate-400 hover:text-blue-600">No underwrite yet</Link>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Underwrites */}
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Underwrites</CardTitle>
              <Link href="/underwrite" className="text-xs text-blue-600 hover:underline flex items-center gap-1">All <ArrowRight size={12} /></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {underwrites.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No underwrites yet</p>
            ) : underwrites.slice(0, 10).map((u) => {
              const s = UW_STATUS[u.status] ?? { label: u.status, color: "bg-slate-100 text-slate-700" };
              return (
                <Link key={u.id} href={`/underwrite/${u.id}`}>
                  <div className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.company.name}</p>
                      <p className="text-xs text-slate-400">
                        {u.analystName ? `${u.analystName} · ` : ""}{format(new Date(u.createdAt), "MMM d")}
                      </p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.label}</span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
