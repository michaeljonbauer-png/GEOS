"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BookmarkMinus, ThumbsDown } from "lucide-react";
import { formatARR, formatGrowth, scoreColor, getPriorityConfig, PIPELINE_STAGES } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface Company {
  id: string;
  name: string;
  sector: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  totalScore: number | null;
  priority: string;
  status: string;
  contacts: { firstName: string; lastName: string; title: string | null }[];
  _count: { interactions: number };
}

const STAGE_CONFIG: Record<string, { label: string; color: string; headerBg: string }> = {
  IDENTIFIED: { label: "Identified", color: "border-slate-200", headerBg: "bg-slate-50" },
  QUALIFYING: { label: "Qualifying", color: "border-blue-200", headerBg: "bg-blue-50" },
  REACHED_OUT: { label: "Reached Out", color: "border-yellow-200", headerBg: "bg-yellow-50" },
  IN_CONVERSATION: { label: "In Conversation", color: "border-orange-200", headerBg: "bg-orange-50" },
  MEETING_SCHEDULED: { label: "Meeting Scheduled", color: "border-purple-200", headerBg: "bg-purple-50" },
  DUE_DILIGENCE: { label: "Due Diligence", color: "border-indigo-200", headerBg: "bg-indigo-50" },
};


export default function PipelinePage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/companies?sortBy=updatedAt&sortDir=desc")
      .then((r) => r.json())
      .then((all: Company[]) => {
        setCompanies(all.filter((c) => PIPELINE_STAGES.includes(c.status as typeof PIPELINE_STAGES[number])));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeFromPipeline = async (id: string, status: "WATCHLIST" | "PASSED") => {
    const company = companies.find((c) => c.id === id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast({
      title: `${company?.name ?? "Company"} ${status === "WATCHLIST" ? "moved to Watchlist" : "marked as Passed"}`,
      description: "Removed from pipeline — still in your Companies database.",
    });
  };

  const handleDrop = async (status: string) => {
    if (!dragging || dragging === status) return;
    const company = companies.find((c) => c.id === dragging);
    if (!company) return;

    if (status === "WATCHLIST" || status === "PASSED") {
      const id = dragging;
      setDragging(null);
      setDragOver(null);
      await removeFromPipeline(id, status);
      return;
    }

    // Optimistic update
    setCompanies((prev) =>
      prev.map((c) => (c.id === dragging ? { ...c, status } : c))
    );

    await fetch(`/api/companies/${dragging}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setDragging(null);
    setDragOver(null);
  };

  const byStatus = (status: string) =>
    companies.filter((c) => c.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading pipeline...
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {companies.length} active companies · Drag cards to update stage
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const cols = byStatus(stage);
          const isOver = dragOver === stage;

          return (
            <div
              key={stage}
              className={`flex flex-col min-w-[240px] w-60 rounded-xl border-2 transition-colors ${
                isOver ? "border-blue-400 bg-blue-50/50" : config.color
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(stage)}
            >
              {/* Column header */}
              <div className={`${config.headerBg} rounded-t-xl px-3 py-2.5 border-b ${config.color} sticky top-0`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    {config.label}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 border">
                    {cols.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {cols.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-300">
                    Drop here
                  </div>
                )}
                {cols.map((company) => (
                  <div
                    key={company.id}
                    draggable
                    onDragStart={() => setDragging(company.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className={`group bg-white rounded-lg border border-slate-100 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
                      dragging === company.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link href={`/companies/${company.id}`} onClick={(e) => e.stopPropagation()} className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-tight hover:text-blue-600">
                          {company.name}
                        </p>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromPipeline(company.id, "WATCHLIST"); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-amber-600 transition-all"
                          title="Remove from pipeline → Watchlist (keeps company in database)"
                        >
                          <BookmarkMinus size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromPipeline(company.id, "PASSED"); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-500 transition-all"
                          title="Pass — remove from pipeline (keeps company in database)"
                        >
                          <ThumbsDown size={13} />
                        </button>
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${getPriorityConfig(company.priority).dot}`}
                          title={`${getPriorityConfig(company.priority).label} priority`}
                        />
                      </div>
                    </div>

                    {company.sector && (
                      <p className="text-xs text-slate-400 mb-2">{company.sector}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {company.arrEstimate !== null && (
                        <span className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-600">
                          {formatARR(company.arrEstimate)}
                        </span>
                      )}
                      {company.arrGrowth !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${
                          company.arrGrowth >= 100 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                          company.arrGrowth >= 50 ? "bg-green-50 border-green-200 text-green-700" :
                          "bg-slate-50 border-slate-200 text-slate-600"
                        }`}>
                          {formatGrowth(company.arrGrowth)}
                        </span>
                      )}
                    </div>

                    {company.contacts.length > 0 && (
                      <p className="text-[11px] text-slate-400 mb-1.5">
                        {company.contacts[0].firstName} {company.contacts[0].lastName}
                        {company.contacts[0].title && `, ${company.contacts[0].title}`}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {company._count.interactions} activities
                      </span>
                      {company.totalScore !== null && (
                        <span className={`text-sm font-bold ${scoreColor(company.totalScore)}`}>
                          {company.totalScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag-to-remove bar — appears while dragging a card */}
      {dragging && (
        <div className="flex gap-3 pt-3 border-t border-slate-200">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver("WATCHLIST"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop("WATCHLIST")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-colors ${
              dragOver === "WATCHLIST" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-400"
            }`}
          >
            <BookmarkMinus size={15} /> Remove from pipeline → Watchlist
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver("PASSED"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop("PASSED")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-colors ${
              dragOver === "PASSED" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-300 text-slate-400"
            }`}
          >
            <ThumbsDown size={15} /> Pass on this company
          </div>
        </div>
      )}
    </div>
  );
}
