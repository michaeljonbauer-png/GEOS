"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Mail, Linkedin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  COMPANY_TYPES, RELATIONSHIP_STRENGTHS, getCompanyTypeConfig, getRelationshipConfig,
} from "@/lib/utils";

interface CompanyRef { id: string; name: string; companyType: string }

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  relationship: string;
  company: CompanyRef;
  affiliations: { id: string; role: string | null; company: CompanyRef }[];
  lastInteractionAt: string | null;
  _count: { interactions: number };
}

const EMPTY_FORM = {
  firstName: "", lastName: "", title: "", email: "", linkedinUrl: "", phone: "",
  relationship: "UNKNOWN", companyId: "", newCompanyName: "", newCompanyType: "OPERATING_COMPANY",
};

export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [relFilter, setRelFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [companies, setCompanies] = useState<CompanyRef[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchContacts = useCallback(() => {
    const q = search.trim();
    fetch(`/api/contacts${q ? `?search=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then(setContacts)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchContacts, 200);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  useEffect(() => {
    if (!showAdd) return;
    fetch("/api/companies?sortBy=name&sortDir=asc")
      .then((r) => r.json())
      .then((all: CompanyRef[]) => setCompanies(all.map(({ id, name, companyType }) => ({ id, name, companyType }))));
  }, [showAdd]);

  const filtered = contacts.filter((c) =>
    (!typeFilter || c.company.companyType === typeFilter) &&
    (!relFilter || c.relationship === relFilter)
  );

  const companyMatches = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [companies, companyQuery]);
  const exactCompany = companies.find((c) => c.name.toLowerCase() === companyQuery.trim().toLowerCase());
  const selectedCompany = companies.find((c) => c.id === form.companyId);

  const closeAdd = () => { setShowAdd(false); setForm(EMPTY_FORM); setCompanyQuery(""); };

  const addContact = async () => {
    setSaving(true);
    try {
      const { newCompanyName, newCompanyType, companyId, ...rest } = form;
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          ...(companyId ? { companyId } : { newCompany: { name: newCompanyName, companyType: newCompanyType } }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add contact");
      toast(data.linkedExisting
        ? { title: "Existing contact linked", description: `${data.firstName} ${data.lastName} was already in your contacts (same email) — linked instead of duplicating.` }
        : { title: "Contact added" });
      closeAdd();
      router.push(`/contacts/${data.id}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add contact", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.firstName.trim() && form.lastName.trim() && (form.companyId || form.newCompanyName.trim());

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {contacts.length} people across founders, investors, bankers, lenders and LPs
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Contact
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search name, email, title, company…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter || "ALL"} onValueChange={(v) => setTypeFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All company types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All company types</SelectItem>
            {COMPANY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={relFilter || "ALL"} onValueChange={(v) => setRelFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All relationships" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All relationships</SelectItem>
            {RELATIONSHIP_STRENGTHS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Company</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Also connected to</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Relationship</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Last touch</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-slate-400">
                  <Users size={28} className="mx-auto mb-2 text-slate-300" />
                  {contacts.length === 0 ? "No contacts yet — add one, or add contacts from any company page." : "No contacts match these filters."}
                </td>
              </tr>
            ) : filtered.map((c) => {
              const type = getCompanyTypeConfig(c.company.companyType);
              const rel = getRelationshipConfig(c.relationship);
              return (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/contacts/${c.id}`)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                    {c.title && <p className="text-xs text-slate-500">{c.title}</p>}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/companies/${c.company.id}`} className="text-slate-700 hover:text-blue-600 hover:underline">{c.company.name}</Link>
                    <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded border ${type.color}`}>{type.label}</span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {c.affiliations.length === 0 ? <span className="text-slate-300">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {c.affiliations.map((a) => (
                          <Link key={a.id} href={`/companies/${a.company.id}`} title={a.role ?? undefined}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                            {a.company.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${rel.color}`}>{rel.label}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {c.lastInteractionAt ? `${formatDistanceToNow(new Date(c.lastInteractionAt))} ago` : <span className="text-slate-300">Never</span>}
                    {c._count.interactions > 0 && <span className="text-slate-400"> · {c._count.interactions}</span>}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      {c.email && <a href={`mailto:${c.email}`} className="text-slate-400 hover:text-blue-600" title={c.email}><Mail size={15} /></a>}
                      {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600"><Linkedin size={15} /></a>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showAdd} onOpenChange={(o) => (o ? setShowAdd(true) : closeAdd())}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input className="mt-1" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input className="mt-1" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Company *</Label>
              {selectedCompany ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                  <span>{selectedCompany.name} <span className="text-xs text-slate-500">· {getCompanyTypeConfig(selectedCompany.companyType).label}</span></span>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setForm((f) => ({ ...f, companyId: "" }))}>Change</button>
                </div>
              ) : (
                <>
                  <Input
                    className="mt-1"
                    placeholder="Search existing companies or type a new name…"
                    value={companyQuery}
                    onChange={(e) => { setCompanyQuery(e.target.value); setForm((f) => ({ ...f, newCompanyName: e.target.value })); }}
                  />
                  {companyMatches.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                      {companyMatches.map((c) => (
                        <button key={c.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                          onClick={() => { setForm((f) => ({ ...f, companyId: c.id, newCompanyName: "" })); setCompanyQuery(""); }}>
                          {c.name} <span className="text-xs text-slate-400">· {getCompanyTypeConfig(c.companyType).label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {companyQuery.trim() && !exactCompany && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span className="shrink-0">New company &ldquo;{companyQuery.trim()}&rdquo; as</span>
                      <Select value={form.newCompanyType} onValueChange={(v) => setForm((f) => ({ ...f, newCompanyType: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPANY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input className="mt-1" placeholder="CEO, Partner, MD…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Relationship</Label>
                <Select value={form.relationship} onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_STRENGTHS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input className="mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>LinkedIn URL</Label>
                <Input className="mt-1" value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>Cancel</Button>
            <Button onClick={addContact} disabled={!canSave || saving}>{saving ? "Saving…" : "Add Contact"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
