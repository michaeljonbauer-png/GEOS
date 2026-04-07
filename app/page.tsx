"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Building2,
  TrendingUp,
  Send,
  CheckCircle2,
  ArrowRight,
  Mail,
  Phone,
  Linkedin,
  Calendar,
  StickyNote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusConfig, formatARR, scoreColor } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DashboardData {
  totalCompanies: number;
  activeDeals: number;
  invested: number;
  pipeline: Record<string, number>;
  recentInteractions: {
    id: string;
    type: string;
    subject: string | null;
    date: string;
    company: { id: string; name: string };
    contact: { firstName: string; lastName: string } | null;
  }[];
  topCompanies: {
    id: string;
    name: string;
    sector: string | null;
    totalScore: number | null;
    status: string;
    arrEstimate: number | null;
  }[];
  recentlyAdded: {
    id: string;
    name: string;
    sector: string | null;
    status: string;
    createdAt: string;
  }[];
  interactionsByType: { type: string; _count: number }[];
}

const PIPELINE_LABELS: Record<string, string> = {
  IDENTIFIED: "Identified",
  QUALIFYING: "Qualifying",
  REACHED_OUT: "Reached Out",
  IN_CONVERSATION: "Conversing",
  MEETING_SCHEDULED: "Meeting Set",
  DUE_DILIGENCE: "Diligence",
};

const PIPELINE_COLORS: Record<string, string> = {
  IDENTIFIED: "#94a3b8",
  QUALIFYING: "#60a5fa",
  REACHED_OUT: "#facc15",
  IN_CONVERSATION: "#fb923c",
  MEETING_SCHEDULED: "#a78bfa",
  DUE_DILIGENCE: "#818cf8",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  LINKEDIN_MESSAGE: <Linkedin size={14} />,
  CALL: <Phone size={14} />,
  MEETING: <Calendar size={14} />,
  NOTE: <StickyNote size={14} />,
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) return null;

  const pipelineChartData = Object.entries(PIPELINE_LABELS).map(
    ([key, label]) => ({
      name: label,
      value: data.pipeline[key] ?? 0,
      key,
    })
  );

  const stats = [
    {
      label: "Total Companies",
      value: data.totalCompanies,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/companies",
    },
    {
      label: "Active Pipeline",
      value: data.activeDeals,
      icon: TrendingUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/pipeline",
    },
    {
      label: "Outreaches (30d)",
      value:
        (data.interactionsByType.find((i) => i.type === "EMAIL")?._count ?? 0) +
        (data.interactionsByType.find((i) => i.type === "LINKEDIN_MESSAGE")?._count ?? 0),
      icon: Send,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/outreach",
    },
    {
      label: "Invested",
      value: data.invested,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/companies?status=INVESTED",
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 ${bg}`}>
                    <Icon className={color} size={22} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pipeline Chart + Top Scored */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Pipeline funnel */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deal Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineChartData} barSize={40}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pipelineChartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={PIPELINE_COLORS[entry.key] ?? "#60a5fa"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top scored companies */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top Scored</CardTitle>
              <Link
                href="/companies?sortBy=totalScore&sortDir=desc"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                All <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topCompanies.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No scored companies yet
              </p>
            ) : (
              data.topCompanies.map((co) => (
                <Link key={co.id} href={`/companies/${co.id}`}>
                  <div className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {co.name}
                      </p>
                      <p className="text-xs text-slate-400">{co.sector ?? "—"}</p>
                    </div>
                    <div className="ml-2 shrink-0">
                      <span
                        className={`text-lg font-bold ${scoreColor(co.totalScore ?? 0)}`}
                      >
                        {co.totalScore?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Recently Added */}
      <div className="grid grid-cols-2 gap-5">
        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Link
                href="/crm"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentInteractions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No recent activity
              </p>
            ) : (
              data.recentInteractions.slice(0, 6).map((interaction) => (
                <div key={interaction.id} className="flex items-start gap-3">
                  <div className="mt-0.5 text-slate-400 shrink-0">
                    {TYPE_ICONS[interaction.type] ?? <Mail size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/companies/${interaction.company.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate"
                      >
                        {interaction.company.name}
                      </Link>
                      <span className="text-xs text-slate-400 shrink-0">
                        {format(new Date(interaction.date), "MMM d")}
                      </span>
                    </div>
                    {interaction.subject && (
                      <p className="text-xs text-slate-500 truncate">
                        {interaction.subject}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recently added */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recently Added</CardTitle>
              <Link
                href="/companies"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                All companies <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentlyAdded.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No companies yet.{" "}
                <Link href="/companies/new" className="text-blue-600 hover:underline">
                  Add one
                </Link>
              </p>
            ) : (
              data.recentlyAdded.map((co) => {
                const status = getStatusConfig(co.status);
                return (
                  <Link key={co.id} href={`/companies/${co.id}`}>
                    <div className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {co.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {co.sector ?? "—"} · Added {format(new Date(co.createdAt), "MMM d")}
                        </p>
                      </div>
                      <Badge className={`${status.color} ml-2 shrink-0 text-xs border-0`}>
                        {status.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
