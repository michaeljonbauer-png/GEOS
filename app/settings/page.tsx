"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  minThreshold: number;
  order: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newCriterion, setNewCriterion] = useState({
    name: "",
    description: "",
    weight: "0.15",
    minThreshold: "5",
  });

  const load = useCallback(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then(setCriteria)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalWeight = criteria
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + c.weight, 0);

  const updateCriterion = async (id: string, data: Partial<Criterion>) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await fetch(`/api/criteria/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to update criterion.", variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("Delete this criterion? Scores will be lost.")) return;
    await fetch(`/api/criteria/${id}`, { method: "DELETE" });
    toast({ title: "Criterion deleted" });
    load();
  };

  const addCriterion = async () => {
    if (!newCriterion.name) return;
    try {
      await fetch("/api/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCriterion.name,
          description: newCriterion.description || undefined,
          weight: parseFloat(newCriterion.weight),
          minThreshold: parseFloat(newCriterion.minThreshold),
        }),
      });
      setNewCriterion({ name: "", description: "", weight: "0.15", minThreshold: "5" });
      setShowAdd(false);
      toast({ title: "Criterion added" });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to add criterion.", variant: "destructive" });
    }
  };

  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Criterion>>>({});

  const setLocal = (id: string, field: string, value: string | number) => {
    setLocalEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  };

  const saveLocal = async (id: string) => {
    const edits = localEdits[id];
    if (!edits) return;
    const data: Partial<Criterion> = {};
    if (edits.name !== undefined) data.name = edits.name as string;
    if (edits.description !== undefined) data.description = edits.description as string;
    if (edits.weight !== undefined) data.weight = Number(edits.weight);
    if (edits.minThreshold !== undefined) data.minThreshold = Number(edits.minThreshold);
    await updateCriterion(id, data);
    setLocalEdits((e) => { const next = { ...e }; delete next[id]; return next; });
    toast({ title: "Saved" });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure your investment criteria and scoring weights</p>
      </div>

      {/* Investment Criteria */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Investment Criteria</CardTitle>
              <CardDescription className="mt-1">
                Define the criteria used to score companies. Weights should sum to 1.0 (100%).
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Criterion
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weight gauge */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  Math.abs(totalWeight - 1) < 0.01 ? "bg-green-500" :
                  totalWeight > 1 ? "bg-red-500" : "bg-yellow-500"
                }`}
                style={{ width: `${Math.min(totalWeight * 100, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${
              Math.abs(totalWeight - 1) < 0.01 ? "text-green-600" :
              totalWeight > 1 ? "text-red-600" : "text-yellow-600"
            }`}>
              {(totalWeight * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-slate-400">/ 100% target</span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading...</p>
          ) : criteria.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No criteria yet. Add your first investment criterion.
            </p>
          ) : (
            <div className="space-y-3">
              {criteria.map((c, idx) => {
                const edits = localEdits[c.id] ?? {};
                const isDirty = Object.keys(edits).length > 0;
                return (
                  <div key={c.id} className={`border rounded-lg p-4 ${c.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-2 text-slate-300">
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <Label className="text-xs">Criterion Name</Label>
                            <Input
                              className="mt-1 text-sm"
                              defaultValue={c.name}
                              onChange={(e) => setLocal(c.id, "name", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Weight (0–1)</Label>
                            <Input
                              className="mt-1 text-sm"
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              defaultValue={c.weight}
                              onChange={(e) => setLocal(c.id, "weight", e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              = {((Number(edits.weight ?? c.weight)) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <Label className="text-xs">Description (optional)</Label>
                            <Input
                              className="mt-1 text-sm"
                              defaultValue={c.description ?? ""}
                              placeholder="What does this criterion measure?"
                              onChange={(e) => setLocal(c.id, "description", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Min Threshold (0–10)</Label>
                            <Input
                              className="mt-1 text-sm"
                              type="number"
                              min="0"
                              max="10"
                              defaultValue={c.minThreshold}
                              onChange={(e) => setLocal(c.id, "minThreshold", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {isDirty && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveLocal(c.id)}
                            disabled={saving[c.id]}
                          >
                            <Save size={12} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCriterion(c.id, { isActive: !c.isActive })}
                          className="text-xs"
                        >
                          {c.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteCriterion(c.id)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add criterion form */}
          {showAdd && (
            <>
              <Separator className="my-4" />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">New Criterion</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Name *</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. Revenue Growth"
                      value={newCriterion.name}
                      onChange={(e) => setNewCriterion((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (0–1)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      step="0.05"
                      value={newCriterion.weight}
                      onChange={(e) => setNewCriterion((f) => ({ ...f, weight: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="mt-1"
                      placeholder="What does this measure?"
                      value={newCriterion.description}
                      onChange={(e) => setNewCriterion((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min Threshold</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      value={newCriterion.minThreshold}
                      onChange={(e) => setNewCriterion((f) => ({ ...f, minThreshold: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCriterion} disabled={!newCriterion.name}>
                    Add Criterion
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Default criteria hint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested B2B Growth Equity Criteria</CardTitle>
          <CardDescription>Common criteria used by growth equity investors to evaluate B2B software companies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { name: "Revenue Scale (ARR)", weight: "15%", desc: "Current ARR size and trajectory" },
              { name: "Revenue Growth", weight: "20%", desc: "YoY ARR growth rate vs peers" },
              { name: "Net Revenue Retention", weight: "15%", desc: "NRR/NDR — expansion & churn signal" },
              { name: "Gross Margin", weight: "10%", desc: "Unit economics and scalability" },
              { name: "Market Size (TAM)", weight: "15%", desc: "Addressable market opportunity" },
              { name: "Competitive Moat", weight: "10%", desc: "Defensibility, switching costs, network effects" },
              { name: "Team Quality", weight: "10%", desc: "Founder-market fit, track record, depth" },
              { name: "Go-to-Market Efficiency", weight: "5%", desc: "Sales motion, CAC payback, efficiency" },
            ].map((c) => (
              <div key={c.name} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-800 text-xs">{c.name}</span>
                  <span className="text-xs text-blue-600 font-semibold">{c.weight}</span>
                </div>
                <p className="text-[11px] text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
