import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  FileBarChart,
  Bell,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const plannedFeatures = [
  {
    icon: BarChart3,
    title: "Portfolio Overview",
    description:
      "Aggregated view of all invested companies — ARR, growth, headcount, and key operational KPIs across the portfolio.",
  },
  {
    icon: TrendingUp,
    title: "KPI Tracking & Monitoring",
    description:
      "Monthly KPI ingestion (ARR, NRR, burn, runway) per company. Trend charts, cohort analysis, and flag-on-miss alerts.",
  },
  {
    icon: DollarSign,
    title: "Investment Ledger",
    description:
      "Track cost basis, ownership %, pro-rata rights, follow-on reserves, valuation marks, and unrealized returns by company.",
  },
  {
    icon: Users,
    title: "Board & Governance",
    description:
      "Board seat tracker, meeting notes, action items, and approval workflows (options grants, budgets, hiring plans).",
  },
  {
    icon: FileBarChart,
    title: "Performance Benchmarking",
    description:
      "Compare portfolio companies against sector benchmarks (Rule of 40, NRR cohorts, CAC payback) and peer comps.",
  },
  {
    icon: Bell,
    title: "Alerts & Exception Reporting",
    description:
      "Proactive flags when companies miss KPI thresholds — growth deceleration, NRR decay, runway <6 months, etc.",
  },
];

export default function PortfolioPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
          <BarChart3 className="text-emerald-600" size={24} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Portfolio Monitoring</h1>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
              Coming Soon
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            Once you invest, GEOS will help you actively manage and monitor your portfolio companies —
            tracking KPIs, board obligations, and portfolio health in one place.
          </p>
        </div>
      </div>

      {/* How it connects */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <ArrowUpRight size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Companies marked{" "}
          <span className="font-semibold">Invested</span> or{" "}
          <span className="font-semibold">Monitoring</span> in your{" "}
          <Link href="/companies" className="underline hover:text-blue-600">
            company database
          </Link>{" "}
          will automatically populate here when this module launches.
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

      {/* Current workaround */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CircleDot size={14} className="text-slate-400" />
            <CardTitle className="text-sm text-slate-600">In the meantime</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-500 space-y-2">
          <p>
            Track your portfolio companies using the existing tools:
          </p>
          <ul className="space-y-1.5 ml-3">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Set company status to <strong className="text-slate-700">Invested</strong> or <strong className="text-slate-700">Monitoring</strong> to filter them in the{" "}
              <Link href="/companies" className="text-blue-600 hover:underline">Companies</Link> view.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Use the <strong className="text-slate-700">Notes</strong> tab on each company profile to log board meeting notes, KPI updates, and decisions.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              Log board meetings and calls in the <strong className="text-slate-700">Activity</strong> tab with follow-up reminders.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
