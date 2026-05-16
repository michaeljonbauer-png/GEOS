"use client";

import { useState } from "react";
import { Sparkles, Radar, Target } from "lucide-react";
import { LeadsTab } from "@/components/sourcing/LeadsTab";
import { HuntTab } from "@/components/sourcing/HuntTab";
import { ScoutTab } from "@/components/sourcing/ScoutTab";

type Tab = "leads" | "hunt" | "scout";

const TABS = [
  { id: "leads" as Tab, label: "Leads", icon: Sparkles, desc: "AI-recommended companies matched to your thesis", active: "bg-violet-600 text-white border-violet-600" },
  { id: "hunt" as Tab, label: "Hunt", icon: Radar, desc: "Describe what you want — Claude finds matching companies", active: "bg-blue-600 text-white border-blue-600" },
  { id: "scout" as Tab, label: "Scout", icon: Target, desc: "Enter specific company names or URLs to research and score", active: "bg-emerald-600 text-white border-emerald-600" },
];

export default function SourcingPage() {
  const [tab, setTab] = useState<Tab>("leads");
  const [scoutPrefill, setScoutPrefill] = useState<string | undefined>();
  const current = TABS.find(t => t.id === tab)!

  const handleScout = (name: string) => {
    setScoutPrefill(name);
    setTab("scout");
  };;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Sourcing</h1>
          <span className="text-[10px] font-mono text-slate-300" title="Deploy marker — confirms the latest build is live">
            build 2026-05-16b
          </span>
        </div>
        <p className="text-sm text-slate-500">{current.desc}</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-px">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors -mb-px ${
              tab === t.id ? t.active : "text-slate-500 bg-white border-slate-200 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* All tabs mounted simultaneously to preserve state across switches */}
      <div className={tab !== "leads" ? "hidden" : ""}><LeadsTab /></div>
      <div className={tab !== "hunt" ? "hidden" : ""}><HuntTab onScout={handleScout} /></div>
      <div className={tab !== "scout" ? "hidden" : ""}><ScoutTab prefill={scoutPrefill} /></div>
    </div>
  );
}
