"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Mail, Trash2, Save, Send, Users, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface LPContact { id: string; name: string; firm: string | null; email: string | null; phone: string | null; commitment: number | null; type: string; notes: string | null; }
interface LPUpdate { id: string; period: string; title: string; body: string; status: string; sentAt: string | null; createdAt: string; }

const TYPE_COLORS: Record<string, string> = { LP: "bg-blue-100 text-blue-700", CO_INVESTOR: "bg-violet-100 text-violet-700", ADVISOR: "bg-amber-100 text-amber-700" };

const UPDATE_TEMPLATE = `## Portfolio Highlights

- [Company A] grew ARR from $XM to $YM (+Z% YoY), NRR at X%
- [Company B] closed its Series A at $XM valuation

## Fund Metrics

- Total deployed: $XM across X companies
- Portfolio MOIC: X.Xx (unrealized)
- Follow-on reserves: $XM

## Key Risks & Watchlist

- [Company]: [brief note on risk / monitoring item]

## What's Next

- Actively evaluating X new opportunities in [sector]
- Board meetings: [dates]

---
*This update is confidential and intended solely for fund LPs.*`;

export default function LPCommunicationsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<LPContact[]>([]);
  const [updates, setUpdates] = useState<LPUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", firm: "", email: "", phone: "", commitment: "", type: "LP", notes: "" });
  const [editingContact, setEditingContact] = useState<LPContact | null>(null);
  const [showNewUpdate, setShowNewUpdate] = useState(false);
  const [newUpdate, setNewUpdate] = useState({ period: "", title: "" });
  const [selectedUpdate, setSelectedUpdate] = useState<LPUpdate | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      fetch("/api/lp/contacts").then(r => r.json()),
      fetch("/api/lp/updates").then(r => r.json()),
    ]);
    setContacts(c); setUpdates(u);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveContact = async () => {
    const url = editingContact ? `/api/lp/contacts/${editingContact.id}` : "/api/lp/contacts";
    const method = editingContact ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...contactForm, commitment: contactForm.commitment ? parseFloat(contactForm.commitment) : null }) });
    if (res.ok) { toast({ title: editingContact ? "Contact updated" : "Contact added" }); setShowAddContact(false); setEditingContact(null); setContactForm({ name: "", firm: "", email: "", phone: "", commitment: "", type: "LP", notes: "" }); load(); }
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/lp/contacts/${id}`, { method: "DELETE" });
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const createUpdate = async () => {
    if (!newUpdate.period || !newUpdate.title) return;
    const res = await fetch("/api/lp/updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newUpdate, body: UPDATE_TEMPLATE }) });
    if (res.ok) { const created = await res.json(); setUpdates(prev => [created, ...prev]); setSelectedUpdate(created); setEditBody(created.body); setShowNewUpdate(false); setNewUpdate({ period: "", title: "" }); }
  };

  const saveUpdate = async () => {
    if (!selectedUpdate) return;
    setSavingUpdate(true);
    const res = await fetch(`/api/lp/updates/${selectedUpdate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: editBody }) });
    if (res.ok) { const updated = await res.json(); setUpdates(prev => prev.map(u => u.id === updated.id ? updated : u)); setSelectedUpdate(updated); toast({ title: "Draft saved" }); }
    setSavingUpdate(false);
  };

  const markSent = async () => {
    if (!selectedUpdate) return;
    const res = await fetch(`/api/lp/updates/${selectedUpdate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "SENT" }) });
    if (res.ok) { const updated = await res.json(); setUpdates(prev => prev.map(u => u.id === updated.id ? updated : u)); setSelectedUpdate(updated); toast({ title: "Marked as sent" }); }
  };

  const deleteUpdate = async (id: string) => {
    await fetch(`/api/lp/updates/${id}`, { method: "DELETE" });
    setUpdates(prev => prev.filter(u => u.id !== id));
    if (selectedUpdate?.id === id) { setSelectedUpdate(null); setEditBody(""); }
  };

  const totalCommitment = contacts.filter(c => c.type === "LP").reduce((s, c) => s + (c.commitment ?? 0), 0);

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading LP communications…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">LP Communications</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage LP contacts and draft quarterly updates</p>
      </div>

      <Tabs defaultValue="updates">
        <TabsList className="mb-6">
          <TabsTrigger value="updates"><FileText size={13} className="mr-1.5" />Updates{updates.length > 0 && <span className="ml-1.5 text-xs">({updates.length})</span>}</TabsTrigger>
          <TabsTrigger value="contacts"><Users size={13} className="mr-1.5" />LP Contacts{contacts.length > 0 && <span className="ml-1.5 text-xs">({contacts.length})</span>}</TabsTrigger>
        </TabsList>

        {/* ── LP Updates ── */}
        <TabsContent value="updates">
          <div className="flex gap-5">
            <div className="w-64 shrink-0 space-y-2">
              <Button size="sm" className="w-full" onClick={() => setShowNewUpdate(true)}><Plus size={13} className="mr-1" />New Update</Button>
              {updates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No updates yet.</p>
              ) : updates.map(u => (
                <button key={u.id} onClick={() => { setSelectedUpdate(u); setEditBody(u.body); }} className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedUpdate?.id === u.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600">{u.period}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${u.status === "SENT" ? "bg-green-50 border-green-300 text-green-700" : "bg-amber-50 border-amber-300 text-amber-700"}`}>{u.status}</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate">{u.title}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(u.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>

            {selectedUpdate ? (
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedUpdate.title}</h2>
                    <p className="text-xs text-slate-500">{selectedUpdate.period} · {selectedUpdate.status === "SENT" && selectedUpdate.sentAt ? `Sent ${new Date(selectedUpdate.sentAt).toLocaleDateString()}` : "Draft"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={saveUpdate} disabled={savingUpdate}><Save size={13} className="mr-1" />{savingUpdate ? "Saving…" : "Save Draft"}</Button>
                    {selectedUpdate.status === "DRAFT" && <Button size="sm" onClick={markSent}><Send size={13} className="mr-1" />Mark Sent</Button>}
                    <Button size="sm" variant="outline" onClick={() => deleteUpdate(selectedUpdate.id)} className="text-red-500 hover:bg-red-50"><Trash2 size={13} /></Button>
                  </div>
                </div>
                <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={28} className="text-sm font-mono resize-none" placeholder="Write your LP update here…" />
                <p className="text-xs text-slate-400">Use markdown for formatting. Distribute via email when ready.</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select an update or create a new one</div>
            )}
          </div>
        </TabsContent>

        {/* ── LP Contacts ── */}
        <TabsContent value="contacts">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-500">
              {contacts.filter(c => c.type === "LP").length} LPs · {totalCommitment > 0 ? `$${totalCommitment.toFixed(1)}M total commitment` : "no commitments entered"}
            </div>
            <Button size="sm" onClick={() => { setEditingContact(null); setContactForm({ name: "", firm: "", email: "", phone: "", commitment: "", type: "LP", notes: "" }); setShowAddContact(true); }}><Plus size={13} className="mr-1" />Add Contact</Button>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No LP contacts yet. Add your LPs, co-investors, and advisors.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contacts.map(c => (
                <Card key={c.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                        {c.firm && <p className="text-xs text-slate-500 truncate">{c.firm}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button onClick={() => { setEditingContact(c); setContactForm({ name: c.name, firm: c.firm ?? "", email: c.email ?? "", phone: c.phone ?? "", commitment: c.commitment?.toString() ?? "", type: c.type, notes: c.notes ?? "" }); setShowAddContact(true); }} className="text-slate-400 hover:text-slate-600"><Pencil size={13} /></button>
                        <button onClick={() => deleteContact(c.id)} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[c.type] ?? "bg-slate-100 text-slate-600"}`}>{c.type.replace("_", " ")}</span>
                      {c.commitment && <span className="text-xs text-slate-500">${c.commitment}M committed</span>}
                    </div>
                    {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"><Mail size={10} />{c.email}</a>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={v => { if (!v) { setShowAddContact(false); setEditingContact(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingContact ? "Edit Contact" : "Add LP Contact"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input className="mt-1" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Firm</Label><Input className="mt-1" value={contactForm.firm} onChange={e => setContactForm(p => ({ ...p, firm: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" className="mt-1" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>Commitment ($M)</Label><Input type="number" step="0.1" className="mt-1" value={contactForm.commitment} onChange={e => setContactForm(p => ({ ...p, commitment: e.target.value }))} /></div>
              <div>
                <Label>Type</Label>
                <select value={contactForm.type} onChange={e => setContactForm(p => ({ ...p, type: e.target.value }))} className="mt-1 w-full h-10 text-sm border border-gray-200 rounded-md px-2 bg-white">
                  <option value="LP">LP</option><option value="CO_INVESTOR">Co-investor</option><option value="ADVISOR">Advisor</option>
                </select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea className="mt-1" rows={2} value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddContact(false); setEditingContact(null); }}>Cancel</Button>
            <Button onClick={saveContact} disabled={!contactForm.name}>{editingContact ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Update Dialog */}
      <Dialog open={showNewUpdate} onOpenChange={setShowNewUpdate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New LP Update</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Period (e.g. Q1 2025)</Label><Input className="mt-1" value={newUpdate.period} onChange={e => setNewUpdate(p => ({ ...p, period: e.target.value }))} placeholder="Q2 2025" /></div>
            <div><Label>Title</Label><Input className="mt-1" value={newUpdate.title} onChange={e => setNewUpdate(p => ({ ...p, title: e.target.value }))} placeholder="Q2 2025 Investor Update" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewUpdate(false)}>Cancel</Button>
            <Button onClick={createUpdate} disabled={!newUpdate.period || !newUpdate.title}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
