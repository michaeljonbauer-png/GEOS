"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isAfter, isBefore, addDays } from "date-fns";
import {
  Building2, Users, TrendingUp, Activity, ArrowRight, Mail, Phone, Linkedin,
  Calendar, StickyNote, Bell, Filter, Sparkles, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusConfig, scoreColor, INTERACTION_TYPES, PIPELINE_STAGES } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DashboardData {
  totalContacts: number;
  totalCompanies: number;
  activeDeals: number;
  pipeline: Record<string, number>;
  topCompanies: { id: string; name: string; sector: string | null; totalScore: number | null }[];
  recentlyAdded: { id: string; name: string; sector: string | null; status: string; createdAt: string }[];
  interactionsByType: { type: string; _count: number }[];
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  date: string;
  followUpDate: string | null;
  followUpDone: boolean;
  company: { id: string; name: string };
  contact: { id: string; firstName: string; lastName: string; title: string | null } | null;
}

const PIPELINE_COLORS: Record<string, string> = {
  QUALIFYING: "#60a5fa",
  REACHED_OUT: "#facc15",
  IN_CONVERSATION: "#fb923c",
  DUE_DILIGENCE: "#818cf8",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={15} />,
  LINKEDIN_MESSAGE: <Linkedin size={15} />,
  CALL: <Phone size={15} />,
  MEETING: <Calendar size={15} />,
  NOTE: <StickyNote size={15} />,
};

const TYPE_COLOR: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-600 border-blue-200",
  LINKEDIN_MESSAGE: "bg-sky-50 text-sky-600 border-sky-200",
  CALL: "bg-green-50 text-green-600 border-green-200",
  MEETING: "bg-purple-50 text-purple-600 border-purple-200",
  NOTE: "bg-yellow-50 text-yellow-600 border-yellow-200",
};

const typeLabel = (type: string) => INTERACTION_TYPES.find((t) => t.value === type)?.label ?? type;

function groupByDate(interactions: Interaction[]) {
  const groups = new Map<string, Interaction[]>();
  interactions.forEach((i) => {
    const key = format(new Date(i.date), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });
  return groups;
}

export default function SourcingDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");

  const loadInteractions = useCallback(() => {
    fetch("/api/interactions?limit=150")
      .then((r) => r.json())
      .then(setInteractions)
      .catch(() => setInteractions([]));
  }, []);

  useEffect(() => {
    Promise.all([fetch("/api/dashboard").then((r) => r.json()), loadInteractions()])
      .then(([d]) => setData(d))
      .finally(() => setLoading(false));
  }, [loadInteractions]);

  const markFollowUpDone = async (id: string) => {
    setInteractions((prev) => prev.map((i) => (i.id === id ? { ...i, followUpDone: true } : i)));
    await fetch(`/api/interactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpDone: true }),
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>;
  }
  if (!data) return null;

  const now = new Date();
  const openFollowUps = interactions.filter((i) => i.followUpDate && !i.followUpDone);
  const overdue = openFollowUps
    .filter((i) => isBefore(new Date(i.followUpDate!), now))
    .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  const upcoming = openFollowUps
    .filter((i) => !isBefore(new Date(i.followUpDate!), now) && isBefore(new Date(i.followUpDate!), addDays(now, 14)))
    .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));

  const feed = interactions.filter(
    (i) => (typeFilter === "ALL" || i.type === typeFilter) && (directionFilter === "ALL" || i.direction === directionFilter)
  );
  const grouped = groupByDate(feed);

  const touchpoints30d = data.interactionsByType.reduce((s, t) => s + t._count, 0);
  const pipelineChartData = PIPELINE_STAGES.map((key) => ({
    name: getStatusConfig(key).label,
    value: data.pipeline[key] ?? 0,
    key,
  }));

  const stats = [
    { label: "Companies", value: data.totalCompanies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50", href: "/companies" },
    { label: "Contacts", value: data.totalContacts, icon: Users, color: "text-violet-600", bg: "bg-violet-50", href: "/contacts" },
    { label: "Active Pipeline", value: data.activeDeals, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50", href: "/pipeline" },
    { label: "Touchpoints (30d)", value: touchpoints30d, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50", href: "#activity" },
  ];

  const followUpRow = (i: Interaction, tone: "overdue" | "upcoming") => (
    <div key={i.id} className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Link href={`/companies/${i.company.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate block">
          {i.company.name}
        </Link>
        <p className={`text-xs ${tone === "overdue" ? "text-red-500" : "text-slate-400"}`}>
          {typeLabel(i.type)}
          {i.contact && ` · ${i.contact.firstName} ${i.contact.lastName}`}
          {" · "}{format(new Date(i.followUpDate!), "MMM d")}
        </p>
      </div>
      <button
        onClick={() => markFollowUpDone(i.id)}
        className="text-[11px] text-slate-500 hover:text-green-600 border rounded px-2 py-0.5 hover:border-green-300 shrink-0"
      >
        Done
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sourcing / CRM</h1>
          <p className="text-slate-500 text-sm mt-1">{format(now, "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/sourcing"><Button variant="outline" size="sm"><Sparkles size={14} /> Hunt</Button></Link>
          <Link href="/companies/new"><Button size="sm"><Plus size={14} /> Add company</Button></Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{value}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${bg}`}><Icon className={color} size={22} /></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pipeline + follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline by stage</CardTitle>
              <Link href="/pipeline" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Open pipeline <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineChartData} barSize={48}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={() => router.push("/pipeline")} className="cursor-pointer">
                  {pipelineChartData.map((entry) => <Cell key={entry.key} fill={PIPELINE_COLORS[entry.key] ?? "#60a5fa"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={overdue.length > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Bell size={15} className={overdue.length > 0 ? "text-red-500" : "text-slate-400"} />
              Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdue.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Overdue ({overdue.length})</p>
                {overdue.slice(0, 6).map((i) => followUpRow(i, "overdue"))}
              </div>
            )}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next 14 days ({upcoming.length})</p>
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing scheduled. Add a follow-up date when logging activity.</p>
              ) : (
                upcoming.slice(0, 8).map((i) => followUpRow(i, "upcoming"))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed + side lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card id="activity" className="lg:col-span-2 min-w-0 scroll-mt-20">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Activity log</CardTitle>
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <Filter size={12} className="mr-1 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    {INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All directions</SelectItem>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem>
                    <SelectItem value="INBOUND">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {feed.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">
                {interactions.length === 0
                  ? "No activity yet. Log calls, meetings and emails — or draft outreach — from any company or contact profile."
                  : "No activity matches these filters."}
              </p>
            ) : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        {format(new Date(dateKey + "T12:00:00"), "EEEE, MMMM d")}
                      </span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="space-y-2.5">
                      {items.map((i) => (
                        <div key={i.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                          <div className={`p-1.5 rounded-lg border shrink-0 ${TYPE_COLOR[i.type] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                            {TYPE_ICON[i.type]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/companies/${i.company.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600">
                                {i.company.name}
                              </Link>
                              {i.contact && (
                                <Link href={`/contacts/${i.contact.id}`} className="text-xs text-slate-500 hover:text-blue-600">
                                  with {i.contact.firstName} {i.contact.lastName}
                                </Link>
                              )}
                              <Badge className={`text-[10px] px-1.5 py-0 border ${i.direction === "INBOUND" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                {typeLabel(i.type)} · {i.direction === "INBOUND" ? "In" : "Out"}
                              </Badge>
                              <span className="text-[11px] text-slate-400 ml-auto">{format(new Date(i.date), "h:mm a")}</span>
                            </div>
                            {i.subject && <p className="text-sm text-slate-800 mt-0.5">{i.subject}</p>}
                            {i.content && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{i.content}</p>}
                            {i.followUpDate && (
                              i.followUpDone ? (
                                <span className="text-[10px] text-slate-300 mt-1 inline-block">✓ Follow-up done</span>
                              ) : (
                                <button
                                  onClick={() => markFollowUpDone(i.id)}
                                  className="mt-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-100"
                                  title="Mark follow-up done"
                                >
                                  <Bell size={9} className="inline mr-0.5" /> Follow-up {format(new Date(i.followUpDate), "MMM d")}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Top scored</CardTitle>
                <Link href="/companies?sortBy=totalScore&sortDir=desc" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  All <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.topCompanies.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">No scored companies yet</p>
              ) : data.topCompanies.map((co) => (
                <Link key={co.id} href={`/companies/${co.id}`}>
                  <div className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{co.name}</p>
                      <p className="text-xs text-slate-400">{co.sector ?? "—"}</p>
                    </div>
                    <span className={`text-lg font-bold ml-2 ${scoreColor(co.totalScore ?? 0)}`}>{co.totalScore?.toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recently added</CardTitle>
                <Link href="/companies" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  All <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.recentlyAdded.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">
                  No companies yet. <Link href="/sourcing" className="text-blue-600 hover:underline">Start hunting</Link>
                </p>
              ) : data.recentlyAdded.map((co) => {
                const status = getStatusConfig(co.status);
                return (
                  <Link key={co.id} href={`/companies/${co.id}`}>
                    <div className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{co.name}</p>
                        <p className="text-xs text-slate-400">Added {format(new Date(co.createdAt), "MMM d")}</p>
                      </div>
                      <Badge className={`${status.color} ml-2 shrink-0 text-xs border-0`}>{status.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
