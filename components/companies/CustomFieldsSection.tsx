"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Globe, Building2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import SourceBadge from "@/components/companies/SourceBadge";

interface FieldDef {
  id: string;
  name: string;
  fieldType: string;
  isGlobal: boolean;
  unit: string | null;
  values: { value: string | null }[];
}

interface Props {
  companyId: string;
  sources: Record<string, { sourceLabel: string; sourceUrl: string | null; capturedAt?: string }>;
  onSourceSaved: (field: string, src: { sourceLabel: string; sourceUrl: string | null; capturedAt?: string }) => void;
}

type FieldType = "TEXT" | "NUMBER" | "BOOLEAN" | "URL";

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "URL", label: "URL / Link" },
];

export default function CustomFieldsSection({ companyId, sources, onSourceSaved }: Props) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("TEXT");
  const [newUnit, setNewUnit] = useState("");
  const [newScope, setNewScope] = useState<"company" | "global">("company");
  const [saving, setSaving] = useState(false);
  const [editingValue, setEditingValue] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/custom-fields?companyId=${companyId}`);
      if (res.ok) setFields(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const addField = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          fieldType: newType,
          isGlobal: newScope === "global",
          companyId,
          unit: newUnit.trim() || null,
        }),
      });
      if (res.ok) {
        setNewName(""); setNewType("TEXT"); setNewUnit(""); setNewScope("company");
        setShowAdd(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (fieldId: string) => {
    await fetch(`/api/custom-fields/${fieldId}`, { method: "DELETE" });
    load();
  };

  const saveValue = async (fieldId: string, value: string) => {
    await fetch(`/api/custom-fields/${fieldId}/value`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, value }),
    });
    setEditingValue((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
    load();
  };

  const renderValue = (field: FieldDef) => {
    const raw = field.values[0]?.value ?? null;
    if (field.fieldType === "BOOLEAN") {
      return raw === "true" ? "Yes" : raw === "false" ? "No" : "—";
    }
    if (field.fieldType === "URL" && raw) {
      return (
        <a href={raw} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-[160px] inline-block">
          {raw.replace(/^https?:\/\//, "")}
        </a>
      );
    }
    return raw ? `${raw}${field.unit ? ` ${field.unit}` : ""}` : "—";
  };

  const renderEditor = (field: FieldDef) => {
    const current = editingValue[field.id] ?? field.values[0]?.value ?? "";
    if (field.fieldType === "BOOLEAN") {
      return (
        <div className="flex gap-2">
          {["true", "false"].map((v) => (
            <button
              key={v}
              onClick={() => saveValue(field.id, v)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${current === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:border-gray-400"}`}
            >
              {v === "true" ? "Yes" : "No"}
            </button>
          ))}
          <button onClick={() => saveValue(field.id, "")} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "URL" ? "url" : "text"}
          value={current}
          onChange={(e) => setEditingValue((prev) => ({ ...prev, [field.id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") saveValue(field.id, current); if (e.key === "Escape") setEditingValue((prev) => { const n = { ...prev }; delete n[field.id]; return n; }); }}
          className="h-7 text-sm w-36"
          placeholder={field.fieldType === "URL" ? "https://…" : field.unit ?? "—"}
        />
        {field.unit && <span className="text-xs text-gray-500">{field.unit}</span>}
        <button onClick={() => saveValue(field.id, current)} className="text-green-600 hover:text-green-700"><Check size={13} /></button>
        <button onClick={() => setEditingValue((prev) => { const n = { ...prev }; delete n[field.id]; return n; })} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
    );
  };

  if (loading) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Custom Fields</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Add field
        </button>
      </div>

      {/* Add field form */}
      {showAdd && (
        <div className="mb-3 p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Field Name</Label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. EBITDA, CAC Payback…"
                className="mt-1 h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && addField()}
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as FieldType)}
                className="mt-1 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                {FIELD_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {newType === "NUMBER" && (
            <div>
              <Label className="text-xs">Unit (optional)</Label>
              <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="$M, %, months…" className="mt-1 h-8 text-sm w-36" />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Scope</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewScope("company")}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${newScope === "company" ? "bg-blue-50 border-blue-400 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
              >
                <Building2 size={12} /> This company only
              </button>
              <button
                onClick={() => setNewScope("global")}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${newScope === "global" ? "bg-violet-50 border-violet-400 text-violet-700" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
              >
                <Globe size={12} /> All companies (global)
              </button>
            </div>
            {newScope === "global" && (
              <p className="text-[11px] text-violet-600 mt-1.5">This field will appear on every company profile.</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={addField} disabled={saving || !newName.trim()}>
              {saving ? "Adding…" : "Add Field"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Field rows */}
      {fields.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400 italic">No custom fields yet. Click &quot;Add field&quot; to create one.</p>
      )}
      <div className="space-y-1">
        {fields.map((field) => (
          <div key={field.id} className="flex items-center justify-between group py-1.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {field.isGlobal ? (
                <Globe size={11} className="text-violet-400 shrink-0" aria-label="Global field — appears on all companies" />
              ) : (
                <Building2 size={11} className="text-blue-400 shrink-0" aria-label="Company-specific field" />
              )}
              <dt className="text-xs text-slate-500 shrink-0">{field.name}{field.unit ? ` (${field.unit})` : ""}</dt>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              {editingValue[field.id] !== undefined || field.fieldType === "BOOLEAN" ? (
                renderEditor(field)
              ) : (
                <>
                  <dd className="text-sm font-medium text-slate-700">{renderValue(field)}</dd>
                  <SourceBadge
                    companyId={companyId}
                    field={`custom_${field.id}`}
                    source={sources[`custom_${field.id}`]}
                    onSaved={(u) => onSourceSaved(`custom_${field.id}`, u)}
                  />
                  <button
                    onClick={() => setEditingValue((prev) => ({ ...prev, [field.id]: field.values[0]?.value ?? "" }))}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                    title="Edit value"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => deleteField(field.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity"
                    title={field.isGlobal ? "Delete global field (removes from all companies)" : "Delete field"}
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
