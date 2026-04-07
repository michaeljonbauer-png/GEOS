"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Mail, Linkedin, Phone, Calendar, StickyNote, Bell, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INTERACTION_TYPES } from "@/lib/utils";

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
  contact: { firstName: string; lastName: string; title: string | null } | null;
}

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

const TYPE_LABELS: Record<string, string> = {
  EMAIL: "Email",
  LINKEDIN_MESSAGE: "LinkedIn",
  CALL: "Call",
  MEETING: "Meeting",
  NOTE: "Note",
};

function groupByDate(interactions: Interaction[]) {
  const groups = new Map<string, Interaction[]>();
  interactions.forEach((i) => {
    const key = format(new Date(i.date), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });
  return groups;
}

export default function CRMPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    fetch(`/api/interactions?${params}`)
      .then((r) => r.json())
      .then(setInteractions)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const markFollowUpDone = async (id: string) => {
    await fetch(`/api/interactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpDone: true }),
    });
    load();
  };

  const filtered = directionFilter === "ALL"
    ? interactions
    : interactions.filter((i) => i.direction === directionFilter);

  const upcoming = interactions.filter(
    (i) =>
      i.followUpDate &&
      !i.followUpDone &&
      isAfter(new Date(i.followUpDate), new Date()) &&
      isBefore(new Date(i.followUpDate), addDays(new Date(), 14))
  ).sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime());

  const overdue = interactions.filter(
    (i) =>
      i.followUpDate &&
      !i.followUpDone &&
      isBefore(new Date(i.followUpDate), new Date())
  );

  const grouped = groupByDate(filtered);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Complete interaction history across all companies
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main feed */}
        <div className="col-span-2">
          {/* Filters */}
          <div className="flex gap-3 mb-5">
            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
            >
              <SelectTrigger className="w-44">
                <Filter size={14} className="mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All directions</SelectItem>
                <SelectItem value="OUTBOUND">Outbound</SelectItem>
                <SelectItem value="INBOUND">Inbound</SelectItem>
              </SelectContent>
            </Select>

            <span className="ml-auto text-sm text-slate-400 self-center">
              {filtered.length} interactions
            </span>
          </div>

          {loading ? (
            <p className="text-center text-slate-400 text-sm py-12">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">
              No activity logged yet.{" "}
              <Link href="/outreach" className="text-blue-600 hover:underline">
                Compose outreach
              </Link>{" "}
              or log from a company profile.
            </p>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([dateKey, items]) => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {format(new Date(dateKey + "T12:00:00"), "EEEE, MMMM d")}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="space-y-3">
                    {items.map((i) => (
                      <div key={i.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`mt-0.5 p-2 rounded-lg border ${TYPE_COLOR[i.type] ?? "bg-slate-50 text-slate-600 border-slate-200"} shrink-0`}>
                              {TYPE_ICON[i.type]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                  {TYPE_LABELS[i.type] ?? i.type}
                                </span>
                                <Badge className={`text-[10px] px-1.5 py-0 border ${i.direction === "INBOUND" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                  {i.direction}
                                </Badge>
                                <Link href={`/companies/${i.company.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600">
                                  {i.company.name}
                                </Link>
                                {i.contact && (
                                  <span className="text-xs text-slate-400">
                                    → {i.contact.firstName} {i.contact.lastName}
                                    {i.contact.title && `, ${i.contact.title}`}
                                  </span>
                                )}
                              </div>
                              {i.subject && (
                                <p className="text-sm font-medium text-slate-800 mt-1">{i.subject}</p>
                              )}
                              {i.content && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                  {i.content}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-400">
                              {format(new Date(i.date), "h:mm a")}
                            </p>
                            {i.followUpDate && !i.followUpDone && (
                              <button
                                onClick={() => markFollowUpDone(i.id)}
                                className="mt-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-100 transition-colors"
                              >
                                <Bell size={9} className="inline mr-0.5" />
                                Follow-up {format(new Date(i.followUpDate), "MMM d")}
                              </button>
                            )}
                            {i.followUpDate && i.followUpDone && (
                              <span className="text-[10px] text-slate-300 block mt-1">
                                ✓ Follow-up done
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar: follow-ups */}
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700">
                  <Bell size={14} className="inline mr-1.5" />
                  Overdue ({overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdue.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link href={`/companies/${i.company.id}`} className="font-medium text-slate-900 hover:text-red-600 text-xs">
                        {i.company.name}
                      </Link>
                      <p className="text-[11px] text-red-400">
                        {format(new Date(i.followUpDate!), "MMM d")}
                      </p>
                    </div>
                    <button
                      onClick={() => markFollowUpDone(i.id)}
                      className="text-[10px] text-slate-400 hover:text-green-600 border rounded px-1.5 py-0.5 hover:border-green-300"
                    >
                      Done
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Bell size={14} className="inline mr-1.5 text-slate-400" />
                Upcoming Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  No upcoming follow-ups
                </p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((i) => (
                    <div key={i.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/companies/${i.company.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate block">
                          {i.company.name}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {TYPE_LABELS[i.type]} · {format(new Date(i.followUpDate!), "MMM d")}
                        </p>
                      </div>
                      <button
                        onClick={() => markFollowUpDone(i.id)}
                        className="text-[10px] text-slate-400 hover:text-green-600 border rounded px-1.5 py-0.5 hover:border-green-300 shrink-0"
                      >
                        Done
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {INTERACTION_TYPES.map((t) => {
                const count = interactions.filter((i) => i.type === t.value).length;
                return (
                  <div key={t.value} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className={`p-1 rounded border ${TYPE_COLOR[t.value] ?? "bg-slate-50 border-slate-200"}`}>
                        {TYPE_ICON[t.value]}
                      </span>
                      {t.label}
                    </div>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
