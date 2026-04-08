"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, GripVertical, Save, ShieldCheck, Zap,
  TrendingUp, ThumbsUp, ThumbsDown, Eye, Flame, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FEEDBACK_SIGNALS, type FeedbackSignal } from "@/lib/thesis";
import Link from "next/link";

// ─── Scoring Criteria Tab ────────────────────────────────────────────────────

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  minThreshold: number;
  order: number;
  isActive: boolean;
}

function ScoringTab() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Criterion>>>({});
  const [newCriterion, setNewCriterion] = useState({
    name: "", description: "", weight: "0.15", minThreshold: "5",
  });

  const load = useCallback(() => {
    fetch("/api/criteria").then((r) => r.json()).then(setCriteria).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalWeight = criteria.filter((c) => c.isActive).reduce((s, c) => s + c.weight, 0);

  const setLocal = (id: string, field: string, value: string | number) =>
    setLocalEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));

  const saveLocal = async (id: string) => {
    const edits = localEdits[id];
    if (!edits) return;
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const data: Partial<Criterion> = {};
      if (edits.name !== undefined) data.name = edits.name as string;
      if (edits.description !== undefined) data.description = edits.description as string;
      if (edits.weight !== undefined) data.weight = Number(edits.weight);
      if (edits.minThreshold !== undefined) data.minThreshold = Number(edits.minThreshold);
      await fetch(`/api/criteria/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      setLocalEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      toast({ title: "Saved" });
      load();
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const addCriterion = async () => {
    if (!newCriterion.name) return;
    await fetch("/api/criteria", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCriterion.name, description: newCriterion.description || undefined, weight: parseFloat(newCriterion.weight), minThreshold: parseFloat(newCriterion.minThreshold) }),
    });
    setNewCriterion({ name: "", description: "", weight: "0.15", minThreshold: "5" });
    setShowAdd(false);
    toast({ title: "Criterion added" });
    load();
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("Delete this criterion? Scores will be lost.")) return;
    await fetch(`/api/criteria/${id}`, { method: "DELETE" });
    toast({ title: "Criterion deleted" });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Investment Scoring Criteria</CardTitle>
            <CardDescription className="mt-1">
              Weighted criteria used to score individual companies 0–10. Weights should sum to 1.0.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Criterion</Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weight gauge */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 bg-slate-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${Math.abs(totalWeight - 1) < 0.01 ? "bg-green-500" : totalWeight > 1 ? "bg-red-500" : "bg-yellow-500"}`}
              style={{ width: `${Math.min(totalWeight * 100, 100)}%` }} />
          </div>
          <span className={`text-sm font-bold ${Math.abs(totalWeight - 1) < 0.01 ? "text-green-600" : totalWeight > 1 ? "text-red-600" : "text-yellow-600"}`}>
            {(totalWeight * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-slate-400">/ 100% target</span>
        </div>

        {loading ? <p className="text-sm text-slate-400 text-center py-8">Loading...</p> : (
          <div className="space-y-3">
            {criteria.map((c) => {
              const edits = localEdits[c.id] ?? {};
              const isDirty = Object.keys(edits).length > 0;
              return (
                <div key={c.id} className={`border rounded-lg p-4 ${c.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 text-slate-300"><GripVertical size={16} /></div>
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Criterion Name</Label>
                          <Input className="mt-1 text-sm" defaultValue={c.name} onChange={(e) => setLocal(c.id, "name", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Weight (0–1)</Label>
                          <Input className="mt-1 text-sm" type="number" step="0.05" min="0" max="1" defaultValue={c.weight} onChange={(e) => setLocal(c.id, "weight", e.target.value)} />
                          <p className="text-[10px] text-slate-400 mt-0.5">= {((Number(edits.weight ?? c.weight)) * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Description</Label>
                          <Input className="mt-1 text-sm" defaultValue={c.description ?? ""} onChange={(e) => setLocal(c.id, "description", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Min Threshold (0–10)</Label>
                          <Input className="mt-1 text-sm" type="number" min="0" max="10" defaultValue={c.minThreshold} onChange={(e) => setLocal(c.id, "minThreshold", e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {isDirty && <Button size="sm" onClick={() => saveLocal(c.id)} disabled={saving[c.id]}><Save size={12} /></Button>}
                      <Button size="sm" variant="outline" onClick={() => fetch(`/api/criteria/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !c.isActive }) }).then(load)} className="text-xs">{c.isActive ? "Disable" : "Enable"}</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteCriterion(c.id)} className="text-red-500 hover:bg-red-50"><Trash2 size={12} /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showAdd && (
          <>
            <Separator className="my-4" />
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">New Criterion</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <Label className="text-xs">Name *</Label>
                  <Input className="mt-1" placeholder="e.g. Revenue Growth" value={newCriterion.name} onChange={(e) => setNewCriterion((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Weight (0–1)</Label>
                  <Input className="mt-1" type="number" step="0.05" value={newCriterion.weight} onChange={(e) => setNewCriterion((f) => ({ ...f, weight: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input className="mt-1" placeholder="What does this measure?" value={newCriterion.description} onChange={(e) => setNewCriterion((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Min Threshold</Label>
                  <Input className="mt-1" type="number" value={newCriterion.minThreshold} onChange={(e) => setNewCriterion((f) => ({ ...f, minThreshold: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addCriterion} disabled={!newCriterion.name}>Add Criterion</Button>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Thesis Tab ───────────────────────────────────────────────────────────────

interface ThesisCriterion {
  id: string;
  name: string;
  description: string | null;
  category: string;
  dataType: string;
  companyField: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  boolField: string | null;
  boolTarget: boolean | null;
  importance: number;
  isActive: boolean;
  notes: string | null;
  order: number;
}

const IMPORTANCE_LABELS: Record<number, string> = { 1: "Low", 2: "Low-Med", 3: "Medium", 4: "High", 5: "Critical" };
const IMPORTANCE_COLOR: Record<number, string> = {
  1: "bg-slate-100 text-slate-600",
  2: "bg-blue-50 text-blue-600",
  3: "bg-yellow-50 text-yellow-700",
  4: "bg-orange-50 text-orange-700",
  5: "bg-red-50 text-red-700",
};

function ThesisTab() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<ThesisCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ThesisCriterion>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "", description: "", category: "SIGNAL", dataType: "TEXT",
    companyField: "", minValue: "", maxValue: "", unit: "",
    boolField: "", importance: "3", notes: "",
  });

  const load = useCallback(() => {
    fetch("/api/thesis").then((r) => r.json()).then(setCriteria).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const hardFilters = criteria.filter((c) => c.category === "HARD_FILTER");
  const signals = criteria.filter((c) => c.category === "SIGNAL");

  const startEdit = (c: ThesisCriterion) => { setEditing(c.id); setEditForm(c); };

  const saveEdit = async () => {
    if (!editing) return;
    await fetch(`/api/thesis/${editing}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        minValue: editForm.minValue !== undefined ? (editForm.minValue !== null ? Number(editForm.minValue) : null) : undefined,
        maxValue: editForm.maxValue !== undefined ? (editForm.maxValue !== null ? Number(editForm.maxValue) : null) : undefined,
        importance: editForm.importance !== undefined ? Number(editForm.importance) : undefined,
      }),
    });
    toast({ title: "Thesis criterion updated" });
    setEditing(null);
    load();
  };

  const toggleActive = async (c: ThesisCriterion) => {
    await fetch(`/api/thesis/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    load();
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("Delete this thesis criterion?")) return;
    await fetch(`/api/thesis/${id}`, { method: "DELETE" });
    load();
  };

  const addCriterion = async () => {
    if (!newForm.name || !newForm.category || !newForm.dataType) return;
    await fetch("/api/thesis", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newForm.name,
        description: newForm.description || undefined,
        category: newForm.category,
        dataType: newForm.dataType,
        companyField: newForm.companyField || undefined,
        minValue: newForm.minValue ? Number(newForm.minValue) : undefined,
        maxValue: newForm.maxValue ? Number(newForm.maxValue) : undefined,
        unit: newForm.unit || undefined,
        boolField: newForm.boolField || undefined,
        importance: Number(newForm.importance),
        notes: newForm.notes || undefined,
      }),
    });
    setNewForm({ name: "", description: "", category: "SIGNAL", dataType: "TEXT", companyField: "", minValue: "", maxValue: "", unit: "", boolField: "", importance: "3", notes: "" });
    setShowAdd(false);
    toast({ title: "Thesis criterion added" });
    load();
  };

  const renderCriterionCard = (c: ThesisCriterion) => {
    const isEditingThis = editing === c.id;
    return (
      <div key={c.id} className={`border rounded-lg p-4 transition-opacity ${c.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-55"}`}>
        {isEditingThis ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Name</Label>
                <Input className="mt-1" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea className="mt-1" rows={2} value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              {c.dataType === "RANGE" && (
                <>
                  <div>
                    <Label className="text-xs">Min Value</Label>
                    <Input className="mt-1" type="number" value={editForm.minValue ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, minValue: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Value</Label>
                    <Input className="mt-1" type="number" value={editForm.maxValue ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, maxValue: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </>
              )}
              {c.category === "SIGNAL" && (
                <div>
                  <Label className="text-xs">Importance (1–5)</Label>
                  <Input className="mt-1" type="number" min="1" max="5" value={editForm.importance ?? 3} onChange={(e) => setEditForm((f) => ({ ...f, importance: Number(e.target.value) }))} />
                </div>
              )}
              <div className="col-span-2">
                <Label className="text-xs">Assessment Notes (guidance for evaluating this criterion)</Label>
                <Textarea className="mt-1" rows={3} placeholder="What to look for, red flags, green flags..." value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}><Save size={12} /> Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-slate-300"><GripVertical size={16} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                {c.category === "SIGNAL" && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${IMPORTANCE_COLOR[Math.round(c.importance)] ?? "bg-slate-100 text-slate-600"}`}>
                    {IMPORTANCE_LABELS[Math.round(c.importance)] ?? c.importance} importance
                  </span>
                )}
                {c.dataType === "RANGE" && c.companyField && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {c.minValue !== null ? `≥ ${c.minValue}` : ""}
                    {c.minValue !== null && c.maxValue !== null ? " – " : ""}
                    {c.maxValue !== null ? `≤ ${c.maxValue}` : ""}
                    {c.unit ? ` ${c.unit}` : ""}
                  </span>
                )}
                {c.dataType === "BOOLEAN" && (
                  <span className="text-[10px] text-slate-400">must be {c.boolTarget ? "Yes" : "No"}</span>
                )}
              </div>
              {c.description && <p className="text-xs text-slate-500 mb-1">{c.description}</p>}
              {c.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 border border-slate-100 italic mt-1">
                  💡 {c.notes}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="text-xs px-2" onClick={() => startEdit(c)}>Edit</Button>
              <Button size="sm" variant="outline" className="text-xs px-2" onClick={() => toggleActive(c)}>{c.isActive ? "Off" : "On"}</Button>
              <Button size="sm" variant="outline" className="px-2 text-red-500 hover:bg-red-50" onClick={() => deleteCriterion(c.id)}><Trash2 size={12} /></Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardContent className="p-4">
          <p className="text-sm text-slate-600">
            <strong>Hard Filters</strong> are pass/fail — any failure disqualifies a company from the thesis.{" "}
            <strong>Signals</strong> are weighted indicators scored by importance. Together they produce a{" "}
            <strong>Thesis Fit %</strong> shown on each company.
          </p>
        </CardContent>
      </Card>

      {/* Hard Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-slate-500" />
              <CardTitle className="text-base">Hard Filters</CardTitle>
              <Badge className="bg-red-50 text-red-700 border-red-200 border text-xs">{hardFilters.length}</Badge>
            </div>
          </div>
          <CardDescription>Pass/fail criteria — a single failure removes the company from consideration.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-400 py-4 text-center">Loading...</p> : (
            <div className="space-y-3">
              {hardFilters.map(renderCriterionCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-slate-500" />
              <CardTitle className="text-base">Quality Signals</CardTitle>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 border text-xs">{signals.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add</Button>
          </div>
          <CardDescription>Positive indicators — weighted by importance to produce the Thesis Fit score.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-400 py-4 text-center">Loading...</p> : (
            <div className="space-y-3">
              {signals.map(renderCriterionCard)}
            </div>
          )}

          {showAdd && (
            <>
              <Separator className="my-4" />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold">New Thesis Criterion</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Name *</Label>
                    <Input className="mt-1" value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newForm.category} onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}>
                      <option value="SIGNAL">Signal</option>
                      <option value="HARD_FILTER">Hard Filter</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Data Type</Label>
                    <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newForm.dataType} onChange={(e) => setNewForm((f) => ({ ...f, dataType: e.target.value }))}>
                      <option value="TEXT">Qualitative / Manual</option>
                      <option value="RANGE">Numeric Range</option>
                      <option value="BOOLEAN">Boolean (Yes/No)</option>
                    </select>
                  </div>
                  {newForm.dataType === "RANGE" && (
                    <>
                      <div>
                        <Label className="text-xs">Company Field</Label>
                        <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newForm.companyField} onChange={(e) => setNewForm((f) => ({ ...f, companyField: e.target.value }))}>
                          <option value="">—</option>
                          <option value="founded">founded</option>
                          <option value="employees">employees</option>
                          <option value="totalFundingM">totalFundingM</option>
                          <option value="arrEstimate">arrEstimate</option>
                          <option value="arrGrowth">arrGrowth</option>
                          <option value="nrrEstimate">nrrEstimate</option>
                          <option value="grossMargin">grossMargin</option>
                          <option value="acv">acv</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Input className="mt-1" placeholder="$M, year, employees…" value={newForm.unit} onChange={(e) => setNewForm((f) => ({ ...f, unit: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Min Value</Label>
                        <Input className="mt-1" type="number" value={newForm.minValue} onChange={(e) => setNewForm((f) => ({ ...f, minValue: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Max Value</Label>
                        <Input className="mt-1" type="number" value={newForm.maxValue} onChange={(e) => setNewForm((f) => ({ ...f, maxValue: e.target.value }))} />
                      </div>
                    </>
                  )}
                  {newForm.category === "SIGNAL" && (
                    <div>
                      <Label className="text-xs">Importance (1–5)</Label>
                      <Input className="mt-1" type="number" min="1" max="5" value={newForm.importance} onChange={(e) => setNewForm((f) => ({ ...f, importance: e.target.value }))} />
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-xs">Description</Label>
                    <Input className="mt-1" value={newForm.description} onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Assessment Notes (guidance)</Label>
                    <Textarea className="mt-1" rows={2} value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCriterion} disabled={!newForm.name}>Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Feedback / Learning Tab ──────────────────────────────────────────────────

interface FeedbackItem {
  id: string;
  signal: FeedbackSignal;
  notes: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    sector: string | null;
    arrEstimate: number | null;
    employees: number | null;
    founded: number | null;
  };
}

const SIGNAL_CONFIG = {
  HIGH_PRIORITY: { label: "High Priority", icon: Flame, color: "text-red-600 bg-red-50 border-red-200" },
  INTERESTED: { label: "Interested", icon: ThumbsUp, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  WATCH: { label: "Watch", icon: Eye, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  PASS: { label: "Pass", icon: ThumbsDown, color: "text-slate-500 bg-slate-50 border-slate-200" },
} as const;

function FeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feedback").then((r) => r.json()).then(setFeedback).finally(() => setLoading(false));
  }, []);

  const bySignal = (sig: FeedbackSignal) => feedback.filter((f) => f.signal === sig);

  const insights = (() => {
    if (feedback.length < 3) return null;
    const interested = feedback.filter((f) => f.signal === "INTERESTED" || f.signal === "HIGH_PRIORITY");
    const passed = feedback.filter((f) => f.signal === "PASS");

    // Sector patterns
    const interestSectors = interested.map((f) => f.company.sector).filter(Boolean);
    const passSectors = passed.map((f) => f.company.sector).filter(Boolean);
    const sectorCounts = interestSectors.reduce<Record<string, number>>((acc, s) => { acc[s!] = (acc[s!] ?? 0) + 1; return acc; }, {});
    const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];

    // ARR patterns
    const interestARRs = interested.map((f) => f.company.arrEstimate).filter((v) => v !== null) as number[];
    const avgARR = interestARRs.length ? interestARRs.reduce((a, b) => a + b, 0) / interestARRs.length : null;

    return { topSector, avgARR, interested: interested.length, passed: passed.length };
  })();

  if (loading) return <p className="text-sm text-slate-400 text-center py-12">Loading feedback...</p>;

  if (feedback.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ThumbsUp size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No feedback yet</p>
          <p className="text-slate-400 text-xs mt-1">
            Use the{" "}
            <Link href="/companies" className="text-blue-600 hover:underline">Companies list</Link>
            {" "}to mark companies as Interested, Watch, or Pass.
          </p>
          <p className="text-slate-400 text-xs mt-1">As you review more companies, this panel will surface patterns in what you like.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Pattern insights */}
      {insights && (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className="text-indigo-500" />
              <CardTitle className="text-sm text-indigo-800">Pattern Insights</CardTitle>
              <span className="text-xs text-indigo-400">from {feedback.length} rated companies</span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-xs text-slate-400 mb-1">Conversion rate</p>
              <p className="text-2xl font-bold text-slate-800">
                {Math.round((insights.interested / feedback.length) * 100)}%
              </p>
              <p className="text-xs text-slate-500">{insights.interested} of {feedback.length} companies interested</p>
            </div>
            {insights.topSector && (
              <div className="bg-white rounded-lg border border-indigo-100 p-3">
                <p className="text-xs text-slate-400 mb-1">Top sector (interested)</p>
                <p className="text-base font-bold text-slate-800">{insights.topSector[0]}</p>
                <p className="text-xs text-slate-500">{insights.topSector[1]} companies</p>
              </div>
            )}
            {insights.avgARR !== null && (
              <div className="bg-white rounded-lg border border-indigo-100 p-3">
                <p className="text-xs text-slate-400 mb-1">Avg ARR (companies you liked)</p>
                <p className="text-2xl font-bold text-slate-800">${insights.avgARR.toFixed(1)}M</p>
              </div>
            )}
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-xs text-slate-400 mb-1">Passed on</p>
              <p className="text-2xl font-bold text-slate-800">{insights.passed}</p>
              <p className="text-xs text-slate-500">companies not for us</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback by signal */}
      {(["HIGH_PRIORITY", "INTERESTED", "WATCH", "PASS"] as const).map((sig) => {
        const items = bySignal(sig);
        if (items.length === 0) return null;
        const config = SIGNAL_CONFIG[sig];
        const Icon = config.icon;
        return (
          <Card key={sig}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Icon size={14} className={config.color.split(" ")[0]} />
                <CardTitle className="text-sm">{config.label}</CardTitle>
                <Badge className={`${config.color} border text-xs`}>{items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((f) => (
                  <Link key={f.id} href={`/companies/${f.company.id}`}>
                    <div className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{f.company.name}</p>
                        <p className="text-xs text-slate-400">
                          {[f.company.sector, f.company.arrEstimate ? `$${f.company.arrEstimate}M ARR` : null, f.company.employees ? `${f.company.employees} emp` : null].filter(Boolean).join(" · ")}
                        </p>
                        {f.notes && <p className="text-xs text-slate-500 italic mt-0.5">"{f.notes}"</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your investment thesis, scoring criteria, and review feedback patterns.
        </p>
      </div>

      <Tabs defaultValue="thesis">
        <TabsList className="mb-6">
          <TabsTrigger value="thesis">
            <ShieldCheck size={14} className="mr-1.5" /> Investment Thesis
          </TabsTrigger>
          <TabsTrigger value="scoring">
            <TrendingUp size={14} className="mr-1.5" /> Scoring Criteria
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <ThumbsUp size={14} className="mr-1.5" /> Feedback & Learning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thesis"><ThesisTab /></TabsContent>
        <TabsContent value="scoring"><ScoringTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
      </Tabs>
    </div>
  );
}
