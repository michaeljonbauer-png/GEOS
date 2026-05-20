"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ExternalLink, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeUnderwriteScore } from "@/lib/underwrite-scoring";

interface Company {
  id: string;
  name: string;
  sector?: string | null;
  arrEstimate?: number | null;
}

interface UnderwriteRow {
  id: string;
  status: string;
  analystName?: string | null;
  arrGrowth?: number | null;
  ndr?: number | null;
  gdr?: number | null;
  logoRetention?: number | null;
  grossMargin?: number | null;
  ruleOf40?: number | null;
  burnMultiple1yr?: number | null;
  burnMultipleLtd?: number | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    sector?: string | null;
    arrEstimate?: number | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  SCREENING: "bg-slate-100 text-slate-700",
  IN_ANALYSIS: "bg-blue-100 text-blue-700",
  READY_FOR_IC: "bg-emerald-100 text-emerald-700",
  PASSED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  SCREENING: "Screening",
  IN_ANALYSIS: "In Analysis",
  READY_FOR_IC: "Ready for IC",
  PASSED: "Passed",
};

function formatArr(val?: number | null): string {
  if (val == null) return "—";
  if (val >= 1) return `$${val.toFixed(1)}M`;
  return `$${(val * 1000).toFixed(0)}K`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UnderwriteListPage() {
  const router = useRouter();
  const [underwrites, setUnderwrites] = useState<UnderwriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [analystName, setAnalystName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchUnderwrites = useCallback(async () => {
    try {
      const res = await fetch("/api/underwrite");
      const data = await res.json();
      setUnderwrites(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnderwrites();
  }, [fetchUnderwrites]);

  const openModal = async () => {
    setModalOpen(true);
    if (companies.length === 0) {
      try {
        const res = await fetch("/api/companies");
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : []);
      } catch {
        setCompanies([]);
      }
    }
  };

  const handleCreate = async () => {
    if (!selectedCompanyId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/underwrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, analystName: analystName || undefined }),
      });
      const created = await res.json();
      if (created.id) {
        setModalOpen(false);
        setSelectedCompanyId("");
        setAnalystName("");
        router.push(`/underwrite/${created.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this underwrite? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/underwrite/${id}`, { method: "DELETE" });
      setUnderwrites((prev) => prev.filter((u) => u.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const getCompositeScore = (row: UnderwriteRow): string => {
    const { composite } = computeUnderwriteScore({
      arrGrowth: row.arrGrowth ?? undefined,
      ndr: row.ndr ?? undefined,
      gdr: row.gdr ?? undefined,
      logoRetention: row.logoRetention ?? undefined,
      grossMargin: row.grossMargin ?? undefined,
      ruleOf40: row.ruleOf40 ?? undefined,
      burnMultiple1yr: row.burnMultiple1yr ?? undefined,
      burnMultipleLtd: row.burnMultipleLtd ?? undefined,
    });
    if (composite === null) return "—";
    return `${composite.toFixed(1)} / 10`;
  };

  const getScoreColor = (row: UnderwriteRow): string => {
    const { composite } = computeUnderwriteScore({
      arrGrowth: row.arrGrowth ?? undefined,
      ndr: row.ndr ?? undefined,
      gdr: row.gdr ?? undefined,
      logoRetention: row.logoRetention ?? undefined,
      grossMargin: row.grossMargin ?? undefined,
      ruleOf40: row.ruleOf40 ?? undefined,
      burnMultiple1yr: row.burnMultiple1yr ?? undefined,
      burnMultipleLtd: row.burnMultipleLtd ?? undefined,
    });
    if (composite === null) return "text-slate-400";
    if (composite >= 8) return "text-emerald-600 font-semibold";
    if (composite >= 6) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="text-blue-500" size={24} />
            <h1 className="text-2xl font-bold text-slate-900">Underwrite</h1>
          </div>
          <p className="text-sm text-slate-500">Pre-LOI opportunity analysis</p>
        </div>
        <Button onClick={openModal} className="flex items-center gap-2">
          <Plus size={16} />
          New underwrite
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : underwrites.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No underwrites yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Click &quot;New underwrite&quot; to start your first pre-LOI analysis.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Sector</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">ARR</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Analyst</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {underwrites.map((uw) => (
                  <tr key={uw.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/underwrite/${uw.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {uw.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{uw.company.sector ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[uw.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {STATUS_LABELS[uw.status] ?? uw.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatArr(uw.company.arrEstimate)}</td>
                    <td className="px-4 py-3 text-slate-600">{uw.analystName ?? "—"}</td>
                    <td className={`px-4 py-3 ${getScoreColor(uw)}`}>{getCompositeScore(uw)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(uw.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/underwrite/${uw.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-blue-600">
                            <ExternalLink size={14} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-slate-400 hover:text-red-600"
                          disabled={deleting === uw.id}
                          onClick={() => handleDelete(uw.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Underwrite Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Underwrite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="company-select" className="mb-1.5 block">
                Company <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger id="company-select">
                  <SelectValue placeholder="Select a company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.sector ? ` — ${c.sector}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="analyst-name" className="mb-1.5 block">
                Analyst Name (optional)
              </Label>
              <Input
                id="analyst-name"
                placeholder="Your name"
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!selectedCompanyId || creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
