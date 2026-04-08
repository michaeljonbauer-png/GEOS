import Link from "next/link";
import {
  FileText,
  PieChart,
  Table2,
  Mail,
  Lock,
  RefreshCw,
  CircleDot,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plannedFeatures = [
  {
    icon: Table2,
    title: "Fund-Level Financials",
    description:
      "Aggregate fund metrics — deployed capital, NAV, DPI, TVPI, MOIC, and IRR — computed from the investment ledger.",
  },
  {
    icon: PieChart,
    title: "Portfolio Snapshot Reports",
    description:
      "Auto-generated quarterly portfolio snapshots: ARR aggregates, growth rates, headcount, and company-level highlights.",
  },
  {
    icon: FileText,
    title: "Quarterly LP Letters",
    description:
      "AI-drafted LP updates with portfolio narrative, new investments, exits, and market observations. Edit before sending.",
  },
  {
    icon: Mail,
    title: "Investor Communications",
    description:
      "Capital call notices, distribution notices, and ad-hoc LP updates with a configurable distribution list.",
  },
  {
    icon: Lock,
    title: "LP Data Room",
    description:
      "Secure, permissioned portal for LPs to access their statements, capital account, K-1s, and fund documents.",
  },
  {
    icon: RefreshCw,
    title: "Automated Reporting Workflows",
    description:
      "Scheduled report generation with portfolio company data pulled automatically. One-click publish to LP portal.",
  },
];

export default function LPReportingPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 shrink-0">
          <FileText className="text-violet-600" size={24} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">LP Reporting</h1>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
              Coming Soon
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            Generate fund-level financials, portfolio snapshots, and LP communications — all drafted
            from your live portfolio data, with AI assistance for narrative sections.
          </p>
        </div>
      </div>

      {/* Data flow note */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <ArrowUpRight size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <p className="text-sm text-violet-900">
          LP reports will pull live data from the{" "}
          <Link href="/portfolio" className="underline hover:text-violet-700">
            Portfolio Monitoring
          </Link>{" "}
          module — investment ledger, KPI history, and company updates — so reports stay current
          without manual data entry.
        </p>
      </div>

      {/* Planned features grid */}
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

      {/* Report cadence */}
      <Card className="mb-4 border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Typical Reporting Cadence (Planned)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { freq: "Monthly", items: ["Portfolio KPI dashboard", "Exception/alert report", "Cash & deployment summary"] },
              { freq: "Quarterly", items: ["Full LP letter", "Portfolio company snapshots", "NAV & capital account statements", "Investment activity log"] },
              { freq: "Annually", items: ["Audited financial statements", "K-1 / tax documents", "Annual meeting materials", "Fund performance attribution"] },
            ].map(({ freq, items }) => (
              <div key={freq}>
                <p className="font-semibold text-slate-700 mb-2">{freq}</p>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-slate-500">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CircleDot size={14} className="text-slate-400" />
            <CardTitle className="text-sm text-slate-600">In the meantime</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          <p>
            When Portfolio Monitoring launches, this module will be the natural next step. For now, the
            sourcing and pipeline data you're building in GEOS will form the foundation of your fund narrative
            and deal-by-deal reporting once investments are made.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
