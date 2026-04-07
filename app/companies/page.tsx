"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusConfig, formatARR, formatGrowth, scoreColor, COMPANY_STATUSES, SECTORS } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  website: string | null;
  sector: string | null;
  stage: string | null;
  status: string;
  priority: string;
  arrEstimate: number | null;
  arrGrowth: number | null;
  totalScore: number | null;
  updatedAt: string;
  contacts: { firstName: string; lastName: string }[];
  _count: { interactions: number; contacts: number };
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-slate-100 text-slate-600",
};

function CompaniesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [sector, setSector] = useState(searchParams.get("sector") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    (searchParams.get("sortDir") as "asc" | "desc") ?? "desc"
  );

  const fetchCompanies = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (sector) params.set("sector", sector);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    fetch(`/api/companies?${params}`)
      .then((r) => r.json())
      .then(setCompanies)
      .finally(() => setLoading(false));
  }, [search, status, sector, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(fetchCompanies, 200);
    return () => clearTimeout(timer);
  }, [fetchCompanies]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col ? (
      sortDir === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />
    ) : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {companies.length} companies tracked
          </p>
        </div>
        <Link href="/companies/new">
          <Button>
            <Plus size={16} />
            Add Company
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            className="pl-9"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {COMPANY_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sector || "ALL"} onValueChange={(v) => setSector(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sectors</SelectItem>
            {SECTORS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th
                className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                onClick={() => toggleSort("name")}
              >
                <span className="flex items-center gap-1">
                  Company <SortIcon col="name" />
                </span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Sector</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th
                className="text-right px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                onClick={() => toggleSort("arrEstimate")}
              >
                <span className="flex items-center justify-end gap-1">
                  ARR <SortIcon col="arrEstimate" />
                </span>
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                onClick={() => toggleSort("arrGrowth")}
              >
                <span className="flex items-center justify-end gap-1">
                  Growth <SortIcon col="arrGrowth" />
                </span>
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                onClick={() => toggleSort("totalScore")}
              >
                <span className="flex items-center justify-end gap-1">
                  Score <SortIcon col="totalScore" />
                </span>
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">
                Contacts
              </th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">
                Activity
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  No companies found.{" "}
                  <Link href="/companies/new" className="text-blue-600 hover:underline">
                    Add your first company
                  </Link>
                </td>
              </tr>
            ) : (
              companies.map((co) => {
                const statusConfig = getStatusConfig(co.status);
                return (
                  <tr
                    key={co.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/companies/${co.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{co.name}</p>
                          {co.website && (
                            <a
                              href={co.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {co.website.replace(/^https?:\/\//, "")}
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                        {co.priority === "HIGH" && (
                          <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5 py-0">
                            High
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{co.sector ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusConfig.color} border-0 text-xs`}>
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {formatARR(co.arrEstimate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          co.arrGrowth !== null
                            ? co.arrGrowth >= 100
                              ? "text-emerald-600 font-medium"
                              : co.arrGrowth >= 50
                              ? "text-green-600"
                              : "text-slate-600"
                            : "text-slate-400"
                        }
                      >
                        {formatGrowth(co.arrGrowth)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {co.totalScore !== null ? (
                        <span
                          className={`font-bold text-base ${scoreColor(co.totalScore)}`}
                        >
                          {co.totalScore.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {co._count.contacts}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {co._count.interactions}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CompaniesPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading...</div>}>
      <CompaniesPage />
    </Suspense>
  );
}
