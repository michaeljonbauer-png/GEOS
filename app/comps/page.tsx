"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Trash2, Scale, Loader2, Check } from "lucide-react";

interface CompData {
  companyName: string; industry: string; buyer: string; dealDate: string;
  tev: string; arr: string; revenue: string; grossMargin: string;
  yoyGrowth: string; ebitda: string; gdr: string; ndr: string; notes: string;
}

interface SavedComp extends CompData { id: string; }

const EMPTY: CompData = {
  companyName: "", industry: "", buyer: "", dealDate: "",
  tev: "", arr: "", revenue: "", grossMargin: "",
  yoyGrowth: "", ebitda: "", gdr: "", ndr: "", notes: "",
};

const COLS: { key: keyof CompData; label: string; type: string; width: string }[] = [
  { key: "companyName", label: "Company",     type: "text",   width: "min-w-[160px]" },
  { key: "industry",    label: "Industry",    type: "text",   width: "min-w-[140px]" },
  { key: "buyer",       label: "Buyer",       type: "text",   width: "min-w-[140px]" },
  { key: "dealDate",    label: "Date",        type: "date",   width: "min-w-[130px]" },
  { key: "tev",         label: "TEV ($M)",    type: "number", width: "min-w-[90px]"  },
  { key: "arr",         label: "ARR ($M)",    type: "number", width: "min-w-[90px]"  },
  { key: "revenue",     label: "Rev ($M)",    type: "number", width: "min-w-[90px]"  },
  { key: "grossMargin", label: "GM%",         type: "number", width: "min-w-[70px]"  },
  { key: "yoyGrowth",   label: "Growth%",     type: "number", width: "min-w-[80px]"  },
  { key: "ebitda",      label: "EBITDA ($M)", type: "number", width: "min-w-[100px]" },
  { key: "gdr",         label: "GDR%",        type: "number", width: "min-w-[70px]"  },
  { key: "ndr",         label: "NDR%",        type: "number", width: "min-w-[70px]"  },
  { key: "notes",       label: "Notes",       type: "text",   width: "min-w-[160px]" },
];

function fromDb(c: Record<string, unknown>): SavedComp {
  return {
    id: c.id as string,
    companyName: (c.companyName as string) ?? "",
    industry:    (c.industry    as string) ?? "",
    buyer:       (c.buyer       as string) ?? "",
    dealDate:    c.dealDate ? (c.dealDate as string).slice(0, 10) : "",
    tev:         c.tev         != null ? String(c.tev)         : "",
    arr:         c.arr         != null ? String(c.arr)         : "",
    revenue:     c.revenue     != null ? String(c.revenue)     : "",
    grossMargin: c.grossMargin != null ? String(c.grossMargin) : "",
    yoyGrowth:   c.yoyGrowth   != null ? String(c.yoyGrowth)   : "",
    ebitda:      c.ebitda      != null ? String(c.ebitda)      : "",
    gdr:         c.gdr         != null ? String(c.gdr)         : "",
    ndr:         c.ndr         != null ? String(c.ndr)         : "",
    notes:       (c.notes as string) ?? "",
  };
}

function toBody(d: CompData) {
  const n = (s: string) => s.trim() ? Number(s) : null;
  return {
    companyName: d.companyName.trim(),
    industry:    d.industry.trim()    || null,
    buyer:       d.buyer.trim()       || null,
    dealDate:    d.dealDate           || null,
    tev:         n(d.tev),  arr: n(d.arr),  revenue: n(d.revenue),
    grossMargin: n(d.grossMargin),  yoyGrowth: n(d.yoyGrowth),
    ebitda:      n(d.ebitda),  gdr: n(d.gdr),  ndr: n(d.ndr),
    notes:       d.notes.trim()       || null,
  };
}

function calcX(tev: string, base: string) {
  const t = parseFloat(tev), b = parseFloat(base);
  return t > 0 && b > 0 ? `${(t / b).toFixed(1)}×` : "—";
}

const CELL_CLS = "w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-300 border border-transparent focus:border-blue-400 focus:bg-white focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] rounded px-1.5 py-1 outline-none transition-all";

function CellInput({ value, onChange, type, placeholder = "" }: {
  value: string; onChange: (v: string) => void; type: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      step={type === "number" ? "any" : undefined}
      className={CELL_CLS}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function AutoCell({ value }: { value: string }) {
  return (
    <td className="px-2 py-1 bg-blue-50/40 text-sm font-semibold text-blue-700 whitespace-nowrap tabular-nums text-right">
      {value}
    </td>
  );
}

export default function CompsPage() {
  const [comps, setComps]       = useState<SavedComp[]>([]);
  const [edits, setEdits]       = useState<Record<string, CompData>>({});
  const [saving, setSaving]     = useState<Set<string>>(new Set());
  const [flashOk, setFlashOk]   = useState<Set<string>>(new Set());
  const [newRow, setNewRow]     = useState<CompData>({ ...EMPTY });
  const [savingNew, setSavingNew] = useState(false);
  const persisted = useRef<Record<string, string>>({});  // JSON of last-saved data per id

  useEffect(() => {
    fetch("/api/comps").then(r => r.json()).then((data: Record<string, unknown>[]) => {
      const rows = data.map(fromDb);
      setComps(rows);
      const e: Record<string, CompData> = {};
      rows.forEach(r => { e[r.id] = r; persisted.current[r.id] = JSON.stringify(r); });
      setEdits(e);
    });
  }, []);

  const get = (id: string): CompData => edits[id] ?? comps.find(c => c.id === id)!;

  const set = (id: string, key: keyof CompData, val: string) =>
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? comps.find(c => c.id === id)!), [key]: val } }));

  const flash = (id: string) => {
    setFlashOk(prev => new Set(prev).add(id));
    setTimeout(() => setFlashOk(prev => { const s = new Set(prev); s.delete(id); return s; }), 1500);
  };

  const saveExisting = useCallback(async (id: string) => {
    const data = edits[id];
    if (!data?.companyName.trim()) return;
    if (JSON.stringify(data) === persisted.current[id]) return;  // unchanged
    setSaving(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/comps/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(data)),
      });
      if (res.ok) { persisted.current[id] = JSON.stringify(data); flash(id); }
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [edits]);

  const saveNew = async () => {
    if (!newRow.companyName.trim() || savingNew) return;
    setSavingNew(true);
    try {
      const res = await fetch("/api/comps", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(newRow)),
      });
      if (!res.ok) return;
      const created = fromDb(await res.json() as Record<string, unknown>);
      setComps(prev => [...prev, created]);
      setEdits(prev => ({ ...prev, [created.id]: created }));
      persisted.current[created.id] = JSON.stringify(created);
      setNewRow({ ...EMPTY });
    } finally { setSavingNew(false); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/comps/${id}`, { method: "DELETE" });
    setComps(prev => prev.filter(c => c.id !== id));
  };

  const onRowBlur = (id: string) => (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) saveExisting(id);
  };

  const onNewRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) saveNew();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Scale className="text-blue-500" size={20} />
        <h1 className="text-xl font-bold text-slate-900">Comps</h1>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Click any cell to edit inline. Changes save automatically when you tab or click away.
        ARR× and EBITDA× calculate automatically.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {COLS.map(c => (
                <th key={c.key} className={`${c.width} px-2 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap`}>
                  {c.label}
                </th>
              ))}
              <th className="min-w-[70px] px-2 py-2.5 text-right text-[10px] font-semibold text-blue-400 uppercase tracking-wide bg-blue-50/60">ARR×</th>
              <th className="min-w-[80px] px-2 py-2.5 text-right text-[10px] font-semibold text-blue-400 uppercase tracking-wide bg-blue-50/60">EBITDA×</th>
              <th className="w-10 bg-slate-50" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comps.map(comp => {
              const d = get(comp.id);
              return (
                <tr
                  key={comp.id}
                  className="group hover:bg-slate-50/40 transition-colors"
                  onBlur={onRowBlur(comp.id)}
                >
                  {COLS.map(col => (
                    <td key={col.key} className="px-1 py-0.5">
                      <CellInput
                        type={col.type}
                        value={d?.[col.key] ?? ""}
                        onChange={v => set(comp.id, col.key, v)}
                      />
                    </td>
                  ))}
                  <AutoCell value={d ? calcX(d.tev, d.arr) : "—"} />
                  <AutoCell value={d ? calcX(d.tev, d.ebitda) : "—"} />
                  <td className="px-1 py-0.5">
                    <div className="flex items-center justify-center gap-1 h-full">
                      {saving.has(comp.id)  && <Loader2 size={11} className="text-slate-300 animate-spin" />}
                      {flashOk.has(comp.id) && !saving.has(comp.id) && <Check size={11} className="text-emerald-400" />}
                      <button
                        onClick={() => del(comp.id, comp.companyName)}
                        className="p-1 text-slate-200 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Always-visible new row */}
            <tr
              className="bg-slate-50/20 border-t-2 border-dashed border-slate-200 hover:bg-slate-50/40 transition-colors"
              onBlur={onNewRowBlur}
            >
              {COLS.map((col, i) => (
                <td key={col.key} className="px-1 py-0.5">
                  <CellInput
                    type={col.type}
                    value={newRow[col.key]}
                    placeholder={i === 0 ? "New comp…" : ""}
                    onChange={v => setNewRow(prev => ({ ...prev, [col.key]: v }))}
                  />
                </td>
              ))}
              <AutoCell value={calcX(newRow.tev, newRow.arr)} />
              <AutoCell value={calcX(newRow.tev, newRow.ebitda)} />
              <td className="px-1 py-0.5 text-center">
                {savingNew && <Loader2 size={11} className="text-slate-300 animate-spin mx-auto" />}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {comps.length === 0 && !savingNew && (
        <p className="text-xs text-slate-400 text-center mt-3">
          Type a company name in the row above to add your first comp
        </p>
      )}
    </div>
  );
}
