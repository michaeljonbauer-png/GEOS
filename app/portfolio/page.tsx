"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Save, TrendingUp, TrendingDown, Minus, DollarSign, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { formatARR } from "@/lib/utils";

interface Investment {
  investedAmount: number | null; ownershipPct: number | null; investmentDate: string | null;
  roundType: string | null; preMoneyVal: number | null; currentValuation: number | null;
  proRataRights: boolean; boardSeat: boolean; leadInvestor: boolean;
  coInvestors: string | null; reserveAmount: number | null; moic: number | null; notes: string | null;
}

interface KPISnapshot {
  id: string; period: string; arr: number | null; arrGrowth: number | null; nrr: number | null;
  grossMargin: number | null; employees: number | null; burn: number | null; runway: number | null; notes: string | null;
}

interface PortfolioCompany {
  id: string; name: string; sector: string | null; arrEstimate: number | null; arrGrowth: number | null;
  nrrEstimate: number | null; employees: number | null; status: string;
  investment: Investment | null;
  kpiSnapshots: KPISnapshot[];
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();
const PERIODS = Array.from({ length: 8 }, (_, i) => {
  const y = currentYear - Math.floor(i / 4);
  const q = QUARTERS[3 - (i % 4)];
  return `${q} ${y}`;
}).reverse();

function TrendBadge({ growth }: { growth: number | null | undefined }) {
  if (!growth && growth !== 0) return <span className="text-slate-400 text-xs">—</span>;
  const Icon = growth > 5 ? TrendingUp : growth < -5 ? TrendingDown : Minus;
  const color = growth > 5 ? "text-green-600" : growth < -5 ? "text-red-500" : "text-slate-400";
  return <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}><Icon size={11} />{growth > 0 ? "+" : ""}{growth.toFixed(0)}%</span>;
}

function RuleOf40Badge({ arrGrowth, grossMargin }: { arrGrowth: number | null | undefined; grossMargin: number | null | undefined }) {
  if (!arrGrowth && arrGrowth !== 0) return <span className="text-slate-400 text-xs">—</span>;
  if (!grossMargin && grossMargin !== 0) return <span className="text-slate-400 text-xs">—</span>;
  const score = arrGrowth + grossMargin;
  const color = score >= 40 ? "text-green-700 bg-green-50" : score >= 20 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{score.toFixed(0)}</span>;
}

export default function PortfolioPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<PortfolioCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PortfolioCompany | null>(null);
  const [inv, setInv] = useState<Investment>({ investedAmount: null, ownershipPct: null, investmentDate: null, roundType: null, preMoneyVal: null, currentValuation: null, proRataRights: false, boardSeat: false, leadInvestor: false, coInvestors: null, reserveAmount: null, moic: null, notes: null });
  const [kpis, setKpis] = useState<KPISnapshot[]>([]);
  const [addingKPI, setAddingKPI] = useState(false);
  const [newKPI, setNewKPI] = useState({ period: PERIODS[PERIODS.length - 1], arr: "", arrGrowth: "", nrr: "", grossMargin: "", employees: "", burn: "", runway: "", notes: "" });
  const [savingInv, setSavingInv] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/portfolio/companies");
    if (res.ok) { const data = await res.json(); setCompanies(data); if (data.length > 0 && !selected) { setSelected(data[0]); loadCompanyDetail(data[0].id); } }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, []);

  const loadCompanyDetail = async (companyId: string) => {
    const [invRes, kpiRes] = await Promise.all([
      fetch(`/api/portfolio/investment/${companyId}`).then(r => r.json()),
      fetch(`/api/portfolio/kpi/${companyId}`).then(r => r.json()),
    ]);
    setInv(invRes);
    setKpis(kpiRes);
  };

  const selectCompany = (c: PortfolioCompany) => { setSelected(c); loadCompanyDetail(c.id); };

  const saveInvestment = async () => {
    if (!selected) return;
    setSavingInv(true);
    const res = await fetch(`/api/portfolio/investment/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inv) });
    if (res.ok) toast({ title: "Investment saved" });
    setSavingInv(false);
  };

  const saveKPI = async () => {
    if (!selected || !newKPI.period) return;
    const res = await fetch(`/api/portfolio/kpi/${selected.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newKPI) });
    if (res.ok) { const snap = await res.json(); setKpis(prev => [snap, ...prev.filter(k => k.period !== newKPI.period)]); setAddingKPI(false); toast({ title: "KPI snapshot saved" }); }
  };

  // Portfolio summary
  const totalDeployed = companies.reduce((s, c) => s + (c.investment?.investedAmount ?? 0), 0);
  const totalCurrentVal = companies.reduce((s, c) => s + (c.investment?.currentValuation ?? 0), 0);
  // TVPI = (unrealized current value + distributions) / invested capital
  // Since GEOS doesn't yet track distributions, TVPI = current value / invested (same as portfolio MOIC)
  const portfolioMOIC = totalDeployed > 0 ? totalCurrentVal / totalDeployed : null;

  // CAGR for a single investment: (currentVal / invested)^(1/years) - 1
  const calcCAGR = (invested: number | null, currentVal: number | null, investmentDate: string | null): number | null => {
    if (!invested || !currentVal || !investmentDate) return null;
    const years = (Date.now() - new Date(investmentDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years < 0.1) return null;
    return (Math.pow(currentVal / invested, 1 / years) - 1) * 100;
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading portfolio…</div>;

  if (companies.length === 0) return (
    <div className="p-8 max-w-xl mx-auto text-center mt-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mx-auto mb-4"><BarChart3 className="text-emerald-600" size={28} /></div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Portfolio Monitoring</h1>
      <p className="text-slate-500 text-sm mb-4">No portfolio companies yet. Set a company&apos;s status to <strong>Invested</strong> or <strong>Monitoring</strong> in the Companies tab to add them here.</p>
      <Link href="/companies"><Button>Go to Companies</Button></Link>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Company sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-slate-200">
          <h1 className="font-bold text-slate-900">Portfolio</h1>
          <p className="text-xs text-slate-500 mt-0.5">{companies.length} compan{companies.length === 1 ? "y" : "ies"}</p>
        </div>
        {/* Summary strip */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-slate-500">Total deployed</span><span className="font-semibold">{totalDeployed ? `$${totalDeployed.toFixed(1)}M` : "—"}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500">Current value</span><span className="font-semibold">{totalCurrentVal ? `$${totalCurrentVal.toFixed(1)}M` : "—"}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500">TVPI</span><span className={`font-bold ${portfolioMOIC && portfolioMOIC >= 1.5 ? "text-green-600" : "text-slate-700"}`}>{portfolioMOIC ? `${portfolioMOIC.toFixed(2)}×` : "—"}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {companies.map(c => (
            <button key={c.id} onClick={() => selectCompany(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors hover:bg-white ${selected?.id === c.id ? "bg-white border-l-2 border-l-emerald-500" : ""}`}>
              <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400">{formatARR(c.arrEstimate)}</span>
                <TrendBadge growth={c.arrGrowth} />
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
              <Link href={`/companies/${selected.id}`} className="text-blue-600 hover:text-blue-700"><ExternalLink size={14} /></Link>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${selected.status === "INVESTED" ? "bg-green-100 text-green-700" : "bg-teal-100 text-teal-700"}`}>{selected.status}</span>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="investment">
              <TabsList className="mb-5">
                <TabsTrigger value="investment"><DollarSign size={13} className="mr-1" />Investment Details</TabsTrigger>
                <TabsTrigger value="kpis"><TrendingUp size={13} className="mr-1" />KPI History</TabsTrigger>
              </TabsList>

              {/* Investment details */}
              <TabsContent value="investment">
                <div className="grid grid-cols-2 gap-5">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Deal Economics</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Invested Amount ($M)", field: "investedAmount" as keyof Investment },
                        { label: "Ownership %", field: "ownershipPct" as keyof Investment },
                        { label: "Pre-money Valuation ($M)", field: "preMoneyVal" as keyof Investment },
                        { label: "Current Valuation Mark ($M)", field: "currentValuation" as keyof Investment },
                        { label: "MOIC", field: "moic" as keyof Investment },
                        { label: "Follow-on Reserve ($M)", field: "reserveAmount" as keyof Investment },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" step="0.01" className="mt-1 h-8 text-sm" value={(inv[field] as number) ?? ""} onChange={e => setInv(p => ({ ...p, [field]: e.target.value || null }))} />
                        </div>
                      ))}
                      {/* CAGR — derived, read-only */}
                      {(() => {
                        const cagr = calcCAGR(inv.investedAmount, inv.currentValuation, inv.investmentDate);
                        if (!cagr) return null;
                        const color = cagr >= 30 ? "text-green-700" : cagr >= 15 ? "text-amber-700" : "text-red-600";
                        return (
                          <div>
                            <Label className="text-xs text-slate-400">Implied CAGR (calculated)</Label>
                            <p className={`mt-1 text-lg font-bold ${color}`}>{cagr.toFixed(1)}%</p>
                          </div>
                        );
                      })()}
                      <div>
                        <Label className="text-xs">Round Type</Label>
                        <Input className="mt-1 h-8 text-sm" value={inv.roundType ?? ""} onChange={e => setInv(p => ({ ...p, roundType: e.target.value || null }))} placeholder="Seed, Series A…" />
                      </div>
                      <div>
                        <Label className="text-xs">Investment Date</Label>
                        <Input type="date" className="mt-1 h-8 text-sm" value={inv.investmentDate ? inv.investmentDate.slice(0, 10) : ""} onChange={e => setInv(p => ({ ...p, investmentDate: e.target.value || null }))} />
                      </div>
                    </CardContent>
                  </Card>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Rights & Governance</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {[{ label: "Board Seat", field: "boardSeat" as keyof Investment }, { label: "Pro-rata Rights", field: "proRataRights" as keyof Investment }, { label: "Lead Investor", field: "leadInvestor" as keyof Investment }].map(({ label, field }) => (
                          <label key={field} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!inv[field]} onChange={e => setInv(p => ({ ...p, [field]: e.target.checked }))} className="rounded" />
                            <span className="text-sm text-slate-700">{label}</span>
                          </label>
                        ))}
                        <Separator />
                        <div>
                          <Label className="text-xs">Co-investors</Label>
                          <Input className="mt-1 h-8 text-sm" value={inv.coInvestors ?? ""} onChange={e => setInv(p => ({ ...p, coInvestors: e.target.value || null }))} placeholder="Emergence, Bessemer…" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                      <CardContent>
                        <Textarea value={inv.notes ?? ""} onChange={e => setInv(p => ({ ...p, notes: e.target.value || null }))} rows={4} className="text-sm" placeholder="Board observations, key risks, next milestones…" />
                      </CardContent>
                    </Card>
                    <Button onClick={saveInvestment} disabled={savingInv} className="w-full"><Save size={14} className="mr-2" />{savingInv ? "Saving…" : "Save Investment Details"}</Button>
                  </div>
                </div>
              </TabsContent>

              {/* KPI History */}
              <TabsContent value="kpis">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Quarterly KPI Snapshots</h3>
                  <Button size="sm" onClick={() => setAddingKPI(v => !v)}><Plus size={13} className="mr-1" />Add snapshot</Button>
                </div>

                {addingKPI && (
                  <Card className="mb-4 border-dashed">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Period</Label>
                          <select value={newKPI.period} onChange={e => setNewKPI(p => ({ ...p, period: e.target.value }))} className="mt-1 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
                            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        {[
                          { label: "ARR ($M)", key: "arr" }, { label: "ARR Growth (%)", key: "arrGrowth" },
                          { label: "NRR (%)", key: "nrr" }, { label: "Gross Margin (%)", key: "grossMargin" },
                          { label: "Employees", key: "employees" }, { label: "Burn/mo ($M)", key: "burn" },
                          { label: "Runway (mo)", key: "runway" },
                        ].map(({ label, key }) => (
                          <div key={key}>
                            <Label className="text-xs">{label}</Label>
                            <Input type="number" step="0.1" className="mt-1 h-8 text-sm" value={(newKPI as Record<string, string>)[key]} onChange={e => setNewKPI(p => ({ ...p, [key]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                      <div className="mb-3">
                        <Label className="text-xs">Notes</Label>
                        <Input className="mt-1 h-8 text-sm" value={newKPI.notes} onChange={e => setNewKPI(p => ({ ...p, notes: e.target.value }))} placeholder="Key highlights or concerns…" />
                      </div>
                      <div className="flex gap-2"><Button size="sm" onClick={saveKPI}>Save</Button><Button size="sm" variant="outline" onClick={() => setAddingKPI(false)}>Cancel</Button></div>
                    </CardContent>
                  </Card>
                )}

                {kpis.length === 0 && !addingKPI ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No KPI snapshots yet. Add your first quarterly update.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200">
                        {["Period", "ARR", "Growth", "NRR", "GM", "Rule of 40", "Headcount", "Burn/mo", "Runway", "Notes"].map(h => (
                          <th key={h} className={`text-left text-xs font-medium pb-2 pr-4 ${h === "Rule of 40" ? "text-slate-700" : "text-slate-500"}`}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{kpis.map(k => (
                        <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-semibold text-slate-700">{k.period}</td>
                          <td className="py-2 pr-4">{k.arr ? `$${k.arr}M` : "—"}</td>
                          <td className="py-2 pr-4"><TrendBadge growth={k.arrGrowth} /></td>
                          <td className="py-2 pr-4">{k.nrr ? `${k.nrr}%` : "—"}</td>
                          <td className="py-2 pr-4">{k.grossMargin ? `${k.grossMargin}%` : "—"}</td>
                          <td className="py-2 pr-4"><RuleOf40Badge arrGrowth={k.arrGrowth} grossMargin={k.grossMargin} /></td>
                          <td className="py-2 pr-4">{k.employees ?? "—"}</td>
                          <td className="py-2 pr-4">{k.burn ? `$${k.burn}M` : "—"}</td>
                          <td className="py-2 pr-4">{k.runway ? `${k.runway}mo` : "—"}</td>
                          <td className="py-2 pr-4 text-slate-500 text-xs max-w-[160px] truncate">{k.notes ?? ""}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
