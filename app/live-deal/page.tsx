"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Check, Trash2, ChevronDown, ChevronRight, ExternalLink, FileText, Scale, AlertCircle, Clock, CheckCircle2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const WORKSTREAMS = ["FINANCIAL", "LEGAL", "COMMERCIAL", "TECHNICAL", "HR", "MANAGEMENT"] as const;
const WORKSTREAM_COLORS: Record<string, string> = {
  FINANCIAL:  "bg-blue-100 text-blue-700",
  LEGAL:      "bg-violet-100 text-violet-700",
  COMMERCIAL: "bg-amber-100 text-amber-700",
  TECHNICAL:  "bg-cyan-100 text-cyan-700",
  HR:         "bg-pink-100 text-pink-700",
  MANAGEMENT: "bg-slate-100 text-slate-700",
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN:        <CircleDot size={14} className="text-gray-400" />,
  IN_PROGRESS: <Clock size={14} className="text-amber-500" />,
  DONE:        <CheckCircle2 size={14} className="text-green-500" />,
  BLOCKED:     <AlertCircle size={14} className="text-red-500" />,
};
const PRIORITY_COLOR: Record<string, string> = {
  CONVICTION: "text-violet-700", HIGH: "text-red-600", MEDIUM: "text-amber-600",
  LOW: "text-gray-400", UNKNOWN: "text-gray-300",
};

const DEFAULT_DD_TASKS: { title: string; workstream: typeof WORKSTREAMS[number] }[] = [
  { title: "Review last 3 years audited financials", workstream: "FINANCIAL" },
  { title: "Validate ARR/MRR bridge and churn cohorts", workstream: "FINANCIAL" },
  { title: "Unit economics — CAC, LTV, payback period", workstream: "FINANCIAL" },
  { title: "Review cap table and option pool", workstream: "FINANCIAL" },
  { title: "Review customer contracts and MSAs", workstream: "LEGAL" },
  { title: "IP ownership and assignment agreements", workstream: "LEGAL" },
  { title: "Pending litigation or regulatory issues", workstream: "LEGAL" },
  { title: "Data privacy / GDPR / SOC2 compliance", workstream: "LEGAL" },
  { title: "Win/loss analysis and competitive positioning", workstream: "COMMERCIAL" },
  { title: "Reference calls — 5+ customers", workstream: "COMMERCIAL" },
  { title: "Sales pipeline and pipeline coverage", workstream: "COMMERCIAL" },
  { title: "Product roadmap and tech architecture review", workstream: "TECHNICAL" },
  { title: "Security assessment and vulnerability review", workstream: "TECHNICAL" },
  { title: "Key engineer / team retention risk", workstream: "HR" },
  { title: "Founder background checks", workstream: "MANAGEMENT" },
  { title: "Management incentive plan and equity", workstream: "MANAGEMENT" },
];

const DEFAULT_TERMS = [
  "Pre-money Valuation ($M)", "Investment Amount ($M)", "Ownership % (Post-money)",
  "Round Type", "Lead Investor", "Pro-rata Rights", "Board Seat", "Liquidation Preference",
];

interface Task { id: string; title: string; workstream: string; status: string; priority: string; assignee: string | null; dueDate: string | null; notes: string | null; }
interface Term { id: string; name: string; value: string | null; notes: string | null; }
interface Deal {
  id: string; name: string; sector: string | null; arrEstimate: number | null; employees: number | null; status: string;
  contacts: { firstName: string; lastName: string; title: string | null }[];
  diligenceTasks: Task[];
  dealTerms: Term[];
}

export default function LiveDealPage() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", workstream: "FINANCIAL", priority: "MEDIUM" });
  const [addingTerm, setAddingTerm] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const loadDeals = useCallback(async () => {
    const res = await fetch("/api/deals/active");
    if (res.ok) { const data = await res.json(); setDeals(data); if (data.length > 0 && !selectedDeal) setSelectedDeal(data[0]); }
    setLoading(false);
  }, [selectedDeal]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const selectDeal = useCallback(async (deal: Deal) => {
    setSelectedDeal(deal);
    const [t, tm] = await Promise.all([
      fetch(`/api/deals/diligence?companyId=${deal.id}`).then(r => r.json()),
      fetch(`/api/deals/terms?companyId=${deal.id}`).then(r => r.json()),
    ]);
    setTasks(t); setTerms(tm);
  }, []);

  useEffect(() => { if (selectedDeal) selectDeal(selectedDeal); }, []);

  const seedTasks = async () => {
    if (!selectedDeal) return;
    await Promise.all(DEFAULT_DD_TASKS.map(t => fetch("/api/deals/diligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: selectedDeal.id, ...t }) })));
    const t = await fetch(`/api/deals/diligence?companyId=${selectedDeal.id}`).then(r => r.json());
    setTasks(t);
    toast({ title: "DD checklist loaded", description: `${DEFAULT_DD_TASKS.length} standard tasks added.` });
  };

  const seedTerms = async () => {
    if (!selectedDeal) return;
    await Promise.all(DEFAULT_TERMS.map(name => fetch("/api/deals/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: selectedDeal.id, name }) })));
    const tm = await fetch(`/api/deals/terms?companyId=${selectedDeal.id}`).then(r => r.json());
    setTerms(tm);
    toast({ title: "Term sheet template loaded" });
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const task = tasks.find(t => t.id === taskId)!;
    await fetch(`/api/deals/diligence/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...task, status }) });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const addTask = async () => {
    if (!selectedDeal || !newTask.title.trim()) return;
    const res = await fetch("/api/deals/diligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: selectedDeal.id, ...newTask }) });
    if (res.ok) { const created = await res.json(); setTasks(prev => [...prev, created]); setNewTask({ title: "", workstream: "FINANCIAL", priority: "MEDIUM" }); setAddingTask(false); }
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/deals/diligence/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTerm = async (termId: string, value: string) => {
    const term = terms.find(t => t.id === termId)!;
    await fetch(`/api/deals/terms/${termId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...term, value }) });
    setTerms(prev => prev.map(t => t.id === termId ? { ...t, value } : t));
  };

  const addTerm = async () => {
    if (!selectedDeal || !newTermName.trim()) return;
    const res = await fetch("/api/deals/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: selectedDeal.id, name: newTermName }) });
    if (res.ok) { const created = await res.json(); setTerms(prev => [...prev, created]); setNewTermName(""); setAddingTerm(false); }
  };

  const tasksByWorkstream = WORKSTREAMS.map(ws => ({ ws, tasks: tasks.filter(t => t.workstream === ws) })).filter(g => g.tasks.length > 0);
  const done = tasks.filter(t => t.status === "DONE").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading active deals…</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Deal sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-slate-200">
          <h1 className="font-bold text-slate-900">Live Deals</h1>
          <p className="text-xs text-slate-500 mt-0.5">Active due diligence</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {deals.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-slate-400 mb-2">No active deals yet.</p>
              <p className="text-xs text-slate-400">Set a company status to <strong>Due Diligence</strong> or <strong>Meeting Scheduled</strong> in the Companies tab.</p>
              <Link href="/companies"><Button size="sm" variant="outline" className="mt-3 text-xs">Go to Companies</Button></Link>
            </div>
          ) : deals.map(deal => (
            <button
              key={deal.id}
              onClick={() => selectDeal(deal)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors hover:bg-white ${selectedDeal?.id === deal.id ? "bg-white border-l-2 border-l-blue-500" : ""}`}
            >
              <p className="text-sm font-semibold text-slate-800 truncate">{deal.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${deal.status === "DUE_DILIGENCE" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                  {deal.status === "DUE_DILIGENCE" ? "Diligence" : "Meeting"}
                </span>
                {deal.arrEstimate && <span className="text-[10px] text-slate-400">${deal.arrEstimate}M ARR</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Deal detail */}
      {selectedDeal ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">{selectedDeal.name}</h2>
                <Link href={`/companies/${selectedDeal.id}`} className="text-blue-600 hover:text-blue-700">
                  <ExternalLink size={14} />
                </Link>
              </div>
              {selectedDeal.contacts[0] && (
                <p className="text-xs text-slate-500 mt-0.5">{selectedDeal.contacts[0].firstName} {selectedDeal.contacts[0].lastName}{selectedDeal.contacts[0].title ? ` · ${selectedDeal.contacts[0].title}` : ""}</p>
              )}
            </div>
            {tasks.length > 0 && (
              <div className="text-right">
                <p className="text-2xl font-black text-slate-800">{pct}<span className="text-sm font-normal text-slate-400">%</span></p>
                <p className="text-xs text-slate-400">{done}/{tasks.length} tasks done</p>
                <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 ml-auto">
                  <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            <Tabs defaultValue="diligence">
              <TabsList className="mb-5">
                <TabsTrigger value="diligence"><FileText size={13} className="mr-1.5" />DD Checklist{tasks.length > 0 && <span className="ml-1.5 text-xs">({done}/{tasks.length})</span>}</TabsTrigger>
                <TabsTrigger value="terms"><Scale size={13} className="mr-1.5" />Deal Terms{terms.length > 0 && <span className="ml-1.5 text-xs">({terms.filter(t => t.value).length}/{terms.length})</span>}</TabsTrigger>
              </TabsList>

              {/* ── DD Checklist ── */}
              <TabsContent value="diligence">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    {tasks.length === 0 && (
                      <Button size="sm" variant="outline" onClick={seedTasks}>Load standard DD checklist</Button>
                    )}
                    <Button size="sm" onClick={() => setAddingTask(v => !v)}>
                      <Plus size={13} className="mr-1" /> Add task
                    </Button>
                  </div>
                </div>

                {addingTask && (
                  <Card className="mb-4 border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3">
                          <Label className="text-xs">Task</Label>
                          <Input autoFocus value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} className="mt-1" placeholder="What needs to be done?" onKeyDown={e => e.key === "Enter" && addTask()} />
                        </div>
                        <div>
                          <Label className="text-xs">Workstream</Label>
                          <select value={newTask.workstream} onChange={e => setNewTask(p => ({ ...p, workstream: e.target.value }))} className="mt-1 w-full h-9 text-sm border border-gray-200 rounded-md px-2 bg-white">
                            {WORKSTREAMS.map(ws => <option key={ws} value={ws}>{ws.charAt(0) + ws.slice(1).toLowerCase()}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Priority</Label>
                          <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} className="mt-1 w-full h-9 text-sm border border-gray-200 rounded-md px-2 bg-white">
                            {["HIGH", "MEDIUM", "LOW"].map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2"><Button size="sm" onClick={addTask}>Add</Button><Button size="sm" variant="outline" onClick={() => setAddingTask(false)}>Cancel</Button></div>
                    </CardContent>
                  </Card>
                )}

                {tasks.length === 0 && !addingTask && (
                  <div className="text-center py-12 text-slate-400 text-sm">No tasks yet. Load the standard checklist or add tasks manually.</div>
                )}

                <div className="space-y-4">
                  {tasksByWorkstream.map(({ ws, tasks: wsTasks }) => (
                    <Card key={ws}>
                      <button className="w-full" onClick={() => setCollapsed(p => ({ ...p, [ws]: !p[ws] }))}>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {collapsed[ws] ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${WORKSTREAM_COLORS[ws]}`}>{ws.charAt(0) + ws.slice(1).toLowerCase()}</span>
                            </div>
                            <span className="text-xs text-slate-400">{wsTasks.filter(t => t.status === "DONE").length}/{wsTasks.length}</span>
                          </div>
                        </CardHeader>
                      </button>
                      {!collapsed[ws] && (
                        <CardContent className="px-4 pb-3 pt-0 space-y-1">
                          {wsTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2.5 group py-1.5 border-b border-slate-50 last:border-0">
                              <button onClick={() => updateTaskStatus(task.id, task.status === "DONE" ? "OPEN" : "DONE")} className="shrink-0">
                                {STATUS_ICON[task.status]}
                              </button>
                              <span className={`flex-1 text-sm ${task.status === "DONE" ? "line-through text-slate-400" : "text-slate-700"}`}>{task.title}</span>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {(["OPEN","IN_PROGRESS","BLOCKED","DONE"] as const).map(s => (
                                  <button key={s} onClick={() => updateTaskStatus(task.id, s)} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${task.status === s ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>{s === "IN_PROGRESS" ? "WIP" : s.charAt(0) + s.slice(1).toLowerCase()}</button>
                                ))}
                                <button onClick={() => deleteTask(task.id)} className="text-red-300 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                              </div>
                              <span className={`text-[10px] font-semibold ${PRIORITY_COLOR[task.priority]}`}>{task.priority[0]}</span>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ── Deal Terms ── */}
              <TabsContent value="terms">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    {terms.length === 0 && <Button size="sm" variant="outline" onClick={seedTerms}>Load term sheet template</Button>}
                    <Button size="sm" onClick={() => setAddingTerm(v => !v)}><Plus size={13} className="mr-1" /> Add term</Button>
                  </div>
                </div>

                {addingTerm && (
                  <div className="mb-4 flex gap-2">
                    <Input autoFocus value={newTermName} onChange={e => setNewTermName(e.target.value)} placeholder="Term name (e.g. Board Observer Rights)" className="text-sm" onKeyDown={e => e.key === "Enter" && addTerm()} />
                    <Button size="sm" onClick={addTerm}>Add</Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingTerm(false)}>Cancel</Button>
                  </div>
                )}

                {terms.length === 0 && !addingTerm && (
                  <div className="text-center py-12 text-slate-400 text-sm">No terms yet. Load the template or add manually.</div>
                )}

                <Card>
                  <CardContent className="p-0">
                    {terms.map((term, i) => (
                      <div key={term.id} className={`flex items-center gap-3 px-4 py-3 group ${i < terms.length - 1 ? "border-b border-slate-100" : ""}`}>
                        <dt className="text-sm text-slate-500 w-52 shrink-0">{term.name}</dt>
                        <dd className="flex-1">
                          <input
                            className="w-full text-sm font-medium text-slate-800 bg-transparent border-0 outline-none focus:bg-slate-50 focus:px-2 focus:rounded transition-all placeholder:text-slate-300"
                            value={term.value ?? ""}
                            onChange={e => setTerms(prev => prev.map(t => t.id === term.id ? { ...t, value: e.target.value } : t))}
                            onBlur={e => updateTerm(term.id, e.target.value)}
                            placeholder="—"
                          />
                        </dd>
                        <button onClick={async () => { await fetch(`/api/deals/terms/${term.id}`, { method: "DELETE" }); setTerms(prev => prev.filter(t => t.id !== term.id)); }} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity shrink-0"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a deal on the left</div>
      )}
    </div>
  );
}
