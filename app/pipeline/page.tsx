"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BookmarkMinus, ThumbsDown, ChevronDown } from "lucide-react";
import {
  formatARR, formatGrowth, getPriorityConfig, getStatusConfig, PIPELINE_STAGES, PRIORITIES,
} from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface Company {
  id: string;
  name: string;
  sector: string | null;
  subSector: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  priority: string;
  status: string;
  updatedAt: string;
  contacts: { firstName: string; lastName: string; title: string | null }[];
  _count: { interactions: number };
}

const STAGE_DOT: Record<string, string> = {
  QUALIFYING: "bg-blue-500",
  DUE_DILIGENCE: "bg-indigo-500",
};

const MOVE_OPTIONS = {
  stages: PIPELINE_STAGES.map((s) => ({ value: s, label: getStatusConfig(s).label })),
  exits: [
    { value: "INVESTED", label: "Invested (PortCo)" },
    { value: "IN_CONVERSATION", label: "In Conversation (remove)" },
    { value: "REACHED_OUT", label: "Reached Out (remove)" },
    { value: "IDENTIFIED", label: "Identified (remove)" },
    { value: "PASSED", label: "Passed (remove)" },
  ],
};

const COLLAPSE_KEY = "geos.pipeline.collapsed";

const priorityRank = (p: string) => {
  const i = PRIORITIES.findIndex((x) => x.value === p);
  return i === -1 ? PRIORITIES.length : i;
};

export default function PipelinePage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved) setCollapsed(JSON.parse(saved));
    } catch { /* storage unavailable */ }
  }, []);

  const saveCollapsed = (next: Record<string, boolean>) => {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const toggleStage = (stage: string) => saveCollapsed({ ...collapsed, [stage]: !collapsed[stage] });
  const anyExpanded = PIPELINE_STAGES.some((s) => !collapsed[s]);
  const setAll = (isCollapsed: boolean) =>
    saveCollapsed(Object.fromEntries(PIPELINE_STAGES.map((s) => [s, isCollapsed])));

  const load = useCallback(() => {
    fetch("/api/companies?sortBy=updatedAt&sortDir=desc&companyType=OPERATING_COMPANY")
      .then((r) => r.json())
      .then((all: Company[]) => {
        setCompanies(all.filter((c) => PIPELINE_STAGES.includes(c.status as typeof PIPELINE_STAGES[number])));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = (id: string, data: Record<string, string>) =>
    fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

  const moveTo = async (company: Company, status: string) => {
    if (status === company.status) return;
    const leaving = !PIPELINE_STAGES.includes(status as typeof PIPELINE_STAGES[number]);
    setCompanies((prev) =>
      leaving
        ? prev.filter((c) => c.id !== company.id)
        : prev.map((c) => (c.id === company.id ? { ...c, status, updatedAt: new Date().toISOString() } : c))
    );
    await patch(company.id, { status });
    if (leaving) {
      toast({
        title: `${company.name} moved to ${getStatusConfig(status).label}`,
        description: status === "INVESTED" ? "Now tracked in Portfolio." : "Removed from pipeline — still in your Companies database.",
      });
    }
  };

  const cyclePriority = async (company: Company) => {
    const next = PRIORITIES[(priorityRank(company.priority) + 1) % PRIORITIES.length].value;
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, priority: next } : c)));
    await patch(company.id, { priority: next });
  };

  const inStage = (stage: string) =>
    companies
      .filter((c) => c.status === stage)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.updatedAt.localeCompare(a.updatedAt));

  const visibleStages = stageFilter ? [stageFilter] : PIPELINE_STAGES;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading pipeline...</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {companies.length} active opportunit{companies.length === 1 ? "y" : "ies"} · sorted by priority within each stage
        </p>
      </div>

      {/* Stage filter / summary */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setStageFilter("")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!stageFilter ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
        >
          All · {companies.length}
        </button>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stageFilter === stage ? "" : stage)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${stageFilter === stage ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
          >
            <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
            {getStatusConfig(stage).label} · {inStage(stage).length}
          </button>
        ))}
        {!stageFilter && (
          <button onClick={() => setAll(anyExpanded)} className="ml-auto text-xs text-blue-600 hover:underline">
            {anyExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs">
              <th className="pl-12 pr-4 py-2.5 font-medium text-slate-500">Company</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Priority</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-right">ARR</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-right">Growth</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Primary contact</th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-center">Activity</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Last updated</th>
              <th className="px-4 py-2.5 font-medium text-slate-500">Stage</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          {visibleStages.map((stage) => {
            const rows = inStage(stage);
            const isOpen = stageFilter === stage || !collapsed[stage];
            return (
              <tbody key={stage}>
                <tr className="border-t border-slate-200 first:border-t-0">
                  <td colSpan={9} className="p-0">
                    <button
                      onClick={() => toggleStage(stage)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                      <span className={`w-2.5 h-2.5 rounded-full ${STAGE_DOT[stage]}`} />
                      <span className="text-base font-semibold text-slate-900">{getStatusConfig(stage).label}</span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{rows.length}</span>
                    </button>
                  </td>
                </tr>
                {!isOpen ? null : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pl-12 pr-4 pb-3 text-xs text-slate-300">No companies in this stage</td>
                  </tr>
                ) : rows.map((c) => {
                  const p = getPriorityConfig(c.priority);
                  const contact = c.contacts[0];
                  return (
                    <tr key={c.id} className="text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
                      <td className="pl-12 pr-4 py-2.5">
                        <Link href={`/companies/${c.id}`} className="text-slate-800 hover:text-blue-600">{c.name}</Link>
                        {(c.subSector || c.sector) && <p className="text-xs text-slate-400">{c.subSector || c.sector}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => cyclePriority(c)}
                          title="Click to cycle priority"
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border hover:opacity-80 ${p.color}`}
                        >
                          {p.label}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700">{c.arrEstimate !== null ? formatARR(c.arrEstimate) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        {c.arrGrowth !== null ? (
                          <span className={c.arrGrowth >= 100 ? "text-emerald-600 font-medium" : c.arrGrowth >= 50 ? "text-green-600" : "text-slate-600"}>
                            {formatGrowth(c.arrGrowth)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {contact ? (
                          <>
                            {contact.firstName} {contact.lastName}
                            {contact.title && <span className="block text-xs text-slate-400">{contact.title}</span>}
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500">{c._count.interactions}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(c.updatedAt))} ago
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={c.status}
                          onChange={(e) => moveTo(c, e.target.value)}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 hover:border-slate-400"
                        >
                          <optgroup label="Pipeline">
                            {MOVE_OPTIONS.stages.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </optgroup>
                          <optgroup label="Off pipeline">
                            {MOVE_OPTIONS.exits.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveTo(c, "IDENTIFIED")}
                            className="p-1 text-slate-300 hover:text-amber-600 transition-colors"
                            title="Remove from pipeline → Identified (keeps company in database)"
                          >
                            <BookmarkMinus size={14} />
                          </button>
                          <button
                            onClick={() => moveTo(c, "PASSED")}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            title="Pass — remove from pipeline (keeps company in database)"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
