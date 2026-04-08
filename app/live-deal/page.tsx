import Link from "next/link";
import {
  Briefcase,
  ClipboardList,
  Scale,
  FolderOpen,
  Calculator,
  Users,
  CalendarClock,
  FileSignature,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const workflow = [
  { stage: "IOI / First Look", description: "Indication of interest, initial valuation range, term alignment." },
  { stage: "LOI / Term Sheet", description: "Binding or non-binding letter of intent. Key economic and governance terms locked." },
  { stage: "Due Diligence", description: "Financial, legal, commercial, technical, and management DD. Data room access." },
  { stage: "IC Memo", description: "Investment committee memo drafted, reviewed, and approved." },
  { stage: "Closing", description: "Final docs, cap table, wire, and closing checklist completed." },
];

const plannedFeatures = [
  {
    icon: ClipboardList,
    title: "Due Diligence Tracker",
    description:
      "Structured DD checklist across financial, legal, commercial, technical, and HR workstreams. Assign owners, track completion, and flag blockers.",
  },
  {
    icon: FolderOpen,
    title: "Data Room",
    description:
      "Link to VDR (Datasite, Intralinks, Google Drive, etc.), track documents requested vs. received, and note open items from each workstream.",
  },
  {
    icon: Scale,
    title: "Term Sheet / LOI Tracker",
    description:
      "Capture key economic terms — valuation, ownership %, investment amount, liquidation preference, board composition, pro-rata rights.",
  },
  {
    icon: FileSignature,
    title: "IC Memo Builder",
    description:
      "Structure your investment committee memo from company data already in GEOS — thesis fit, scores, research, and deal terms auto-populated.",
  },
  {
    icon: Calculator,
    title: "Cap Table & Returns Modeling",
    description:
      "Model ownership, dilution from future rounds, liquidation waterfall, and return scenarios at exit (3×, 5×, 10× MOIC).",
  },
  {
    icon: Users,
    title: "Advisors & Counsel",
    description:
      "Track legal counsel, financial advisors, management reps, and external consultants engaged on the deal.",
  },
  {
    icon: CalendarClock,
    title: "Deal Timeline & Milestones",
    description:
      "Gantt-style timeline from IOI to close. Key dates, deadlines, exclusivity window, and process milestones with reminders.",
  },
  {
    icon: Briefcase,
    title: "Closing Checklist",
    description:
      "Legal doc checklist (SPA, SHA, disclosure schedules, reps & warranties), signature tracking, wire confirmation, and closing memo.",
  },
];

export default function LiveDealPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 shrink-0">
          <Briefcase className="text-violet-600" size={24} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Live Deal Execution</h1>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
              Coming Soon
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            When you move a company from sourcing into an active deal process, GEOS will manage the
            full execution workflow — from first LOI through due diligence, IC approval, and closing.
          </p>
        </div>
      </div>

      {/* Deal stage flow */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Deal Workflow
        </h2>
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {workflow.map((step, i) => (
            <div key={step.stage} className="flex items-start shrink-0">
              <div className="flex flex-col items-center w-40">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold border-2 border-violet-200 shrink-0">
                  {i + 1}
                </div>
                <p className="text-xs font-semibold text-slate-700 mt-2 text-center">{step.stage}</p>
                <p className="text-[11px] text-slate-400 mt-1 text-center leading-relaxed px-1">{step.description}</p>
              </div>
              {i < workflow.length - 1 && (
                <div className="mt-3.5 text-slate-300 shrink-0">
                  <ArrowRight size={16} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How it connects */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <ArrowRight size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <p className="text-sm text-violet-800">
          Companies in the{" "}
          <span className="font-semibold">Term Sheet</span> or{" "}
          <span className="font-semibold">Diligence</span> pipeline stage in your{" "}
          <Link href="/pipeline" className="underline hover:text-violet-600">
            Pipeline
          </Link>{" "}
          will automatically surface here when this module launches. All existing company data, research,
          and interaction history carries forward into the deal room.
        </p>
      </div>

      {/* Planned features */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Planned Features
      </h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {plannedFeatures.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="border-slate-100">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-slate-100 shrink-0">
                  <Icon size={16} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current workaround */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CircleDot size={14} className="text-slate-400" />
            <CardTitle className="text-sm text-slate-600">In the meantime</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-500 space-y-2">
          <p>Use the existing tools to manage active deals:</p>
          <ul className="space-y-1.5 ml-3">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Move a company to the <strong className="text-slate-700">Term Sheet</strong> or{" "}
              <strong className="text-slate-700">Diligence</strong> stage in the{" "}
              <Link href="/pipeline" className="text-blue-600 hover:underline">Pipeline</Link>{" "}
              to flag it as an active deal.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Use the <strong className="text-slate-700">Notes</strong> tab to log DD findings,
              IC memo drafts, and key open items.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Log calls, meetings, and emails with founders and advisors in the{" "}
              <strong className="text-slate-700">Activity</strong> tab with follow-up reminders.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Use the <strong className="text-slate-700">Research</strong> tab to capture financials,
              customer evidence, and market data gathered during DD.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
