"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface Comp {
  id: string; companyName: string; industry: string | null; buyer: string | null; dealDate: string | null;
  tev: number | null; arr: number | null; revenue: number | null;
  grossMargin: number | null; yoyGrowth: number | null; ebitda: number | null;
  gdr: number | null; ndr: number | null; notes: string | null;
}

type CompForm = Omit<Comp, "id">;

const EMPTY_FORM: CompForm = {
  companyName: "", industry: null, buyer: null, dealDate: null, tev: null, arr: null,
  revenue: null, grossMargin: null, yoyGrowth: null, ebitda: null,
  gdr: null, ndr: null, notes: null,
};

const fmt = (v: number | null, prefix = "", suffix = "", decimals = 1) =>
  v != null ? `${prefix}${v.toFixed(decimals)}${suffix}` : "—";

const multiple = (tev: number | null, base: number | null) =>
  tev != null && base != null && base !== 0 ? `${(tev / base).toFixed(1)}×` : "—";

function CompModal({ comp, onSave, onClose }: {
  comp: CompForm & { id?: string };
  onSave: (data: CompForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CompForm>({ ...comp });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CompForm, v: string) =>
    setForm(f => ({ ...f, [k]: v === "" ? null : v }));

  const numField = (label: string, key: keyof CompForm, unit: string) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label} <span className="font-normal normal-case text-slate-400">{unit}</span></label>
      <input
        type="number" step="any"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={form[key] ?? ""}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  );

  const handleSave = async () => {
    if (!form.companyName.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{comp.id ? "Edit comp" : "Add comp"}</h2>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Company name *</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.companyName} onChange={e => set("companyName", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Industry</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="e.g. Field Service Management" value={form.industry ?? ""} onChange={e => set("industry", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Buyer / Acquirer</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.buyer ?? ""} onChange={e => set("buyer", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Deal date</label>
            <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.dealDate ? form.dealDate.slice(0, 10) : ""} onChange={e => set("dealDate", e.target.value)} />
          </div>
          {numField("TEV", "tev", "($M)")}
          {numField("ARR", "arr", "($M)")}
          {numField("Revenue", "revenue", "($M)")}
          {numField("Gross Margin", "grossMargin", "(%)")}
          {numField("YoY Growth", "yoyGrowth", "(%)")}
          {numField("EBITDA", "ebitda", "($M)")}
          {numField("GDR", "gdr", "(%)")}
          {numField("NDR", "ndr", "(%)")}
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="col-span-2 bg-slate-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-2">
            <p className="text-[11px] text-slate-500">ARR Multiple (auto): <span className="font-bold text-slate-700">{multiple(form.tev as number | null, form.arr as number | null)}</span></p>
            <p className="text-[11px] text-slate-500">EBITDA Multiple (auto): <span className="font-bold text-slate-700">{multiple(form.tev as number | null, form.ebitda as number | null)}</span></p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.companyName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? "Saving…" : "Save comp"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TH = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap ${className}`}>{children}</th>
);
const TD = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap ${className}`}>{children}</td>
);
const AutoTD = ({ children }: { children: React.ReactNode }) => (
  <td className="px-3 py-2.5 text-sm font-semibold text-blue-700 whitespace-nowrap bg-blue-50/50">{children}</td>
);

export default function CompsPage() {
  const { toast } = useToast();
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<(CompForm & { id?: string }) | null>(null);

  const load = async () => {
    const res = await fetch("/api/comps");
    if (res.ok) setComps(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (data: CompForm) => {
    const isEdit = !!(modal as any)?.id;
    const url = isEdit ? `/api/comps/${(modal as any).id}` : "/api/comps";
    const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { toast({ title: "Save failed", variant: "destructive" }); return; }
    setModal(null);
    toast({ title: isEdit ? "Comp updated" : "Comp added" });
    load();
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/comps/${id}`, { method: "DELETE" });
    toast({ title: `"${name}" deleted` });
    setComps(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Scale className="text-blue-500" size={20} />
            <h1 className="text-xl font-bold text-slate-900">Comps</h1>
          </div>
          <p className="text-sm text-slate-500">Track valuation comparables. ARR× and EBITDA× are calculated automatically.</p>
        </div>
        <Button onClick={() => setModal(EMPTY_FORM)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus size={14} className="mr-1.5" />Add comp
        </Button>
      </div>

      {loading && <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>}

      {!loading && comps.length === 0 && (
        <div className="text-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mx-auto mb-4"><Scale className="text-blue-500" size={28} /></div>
          <h3 className="font-semibold text-slate-800 mb-1">No comps yet</h3>
          <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">Add your first valuation comparable to start building your reference database.</p>
          <Button onClick={() => setModal(EMPTY_FORM)} className="bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} className="mr-1.5" />Add first comp</Button>
        </div>
      )}

      {!loading && comps.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full bg-white">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <TH className="sticky left-0 bg-slate-50 z-10">Company</TH>
                <TH>Industry</TH>
                <TH>Buyer</TH>
                <TH>Date</TH>
                <TH>TEV ($M)</TH>
                <TH>ARR ($M)</TH>
                <TH>Rev ($M)</TH>
                <TH>GM%</TH>
                <TH>Growth</TH>
                <TH>EBITDA ($M)</TH>
                <TH>GDR%</TH>
                <TH>NDR%</TH>
                <TH className="bg-blue-50/50 text-blue-500">ARR×</TH>
                <TH className="bg-blue-50/50 text-blue-500">EBITDA×</TH>
                <TH>{""}</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comps.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <TD className="sticky left-0 bg-white font-medium text-slate-900 z-10">{c.companyName}</TD>
                  <TD>{c.industry ?? "—"}</TD>
                  <TD>{c.buyer ?? "—"}</TD>
                  <TD>{c.dealDate ? new Date(c.dealDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</TD>
                  <TD>{fmt(c.tev, "$")}</TD>
                  <TD>{fmt(c.arr, "$")}</TD>
                  <TD>{fmt(c.revenue, "$")}</TD>
                  <TD>{fmt(c.grossMargin, "", "%", 0)}</TD>
                  <TD>{fmt(c.yoyGrowth, "", "%", 0)}</TD>
                  <TD>{fmt(c.ebitda, "$")}</TD>
                  <TD>{fmt(c.gdr, "", "%", 0)}</TD>
                  <TD>{fmt(c.ndr, "", "%", 0)}</TD>
                  <AutoTD>{multiple(c.tev, c.arr)}</AutoTD>
                  <AutoTD>{multiple(c.tev, c.ebitda)}</AutoTD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal({ ...c })} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => del(c.id, c.companyName)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CompModal comp={modal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}
