"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft, Mail, Linkedin, Phone, MapPin, Pencil, Save, X, Trash2, Plus,
  Building2, Unlink, Calendar, StickyNote, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  RELATIONSHIP_STRENGTHS, INTERACTION_TYPES, getCompanyTypeConfig, getStatusConfig,
  isOperatingCompany,
} from "@/lib/utils";

interface CompanyRef { id: string; name: string; companyType: string; status: string; sector: string | null }

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  location: string | null;
  relationship: string;
  notes: string | null;
  companyId: string;
  company: CompanyRef;
  affiliations: { id: string; role: string | null; company: CompanyRef }[];
  interactions: {
    id: string;
    type: string;
    direction: string;
    subject: string | null;
    content: string | null;
    date: string;
    followUpDate: string | null;
    followUpDone: boolean;
    company: { id: string; name: string };
  }[];
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  LINKEDIN_MESSAGE: <Linkedin size={14} />,
  CALL: <Phone size={14} />,
  MEETING: <Calendar size={14} />,
  NOTE: <StickyNote size={14} />,
};

function CompanyTypePill({ type }: { type: string }) {
  const cfg = getCompanyTypeConfig(type);
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>;
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [companies, setCompanies] = useState<{ id: string; name: string; companyType: string }[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linkCompanyId, setLinkCompanyId] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [logForm, setLogForm] = useState({ type: "CALL", direction: "OUTBOUND", subject: "", content: "", followUpDate: "", companyId: "" });

  const load = useCallback(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Contact | null) => {
        setContact(c);
        if (c) setEditForm(c);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!editMode && !showLink) return;
    fetch("/api/companies?sortBy=name&sortDir=asc")
      .then((r) => r.json())
      .then((all: { id: string; name: string; companyType: string }[]) =>
        setCompanies(all.map(({ id, name, companyType }) => ({ id, name, companyType }))));
  }, [editMode, showLink]);

  const linkedCompanies = useMemo(
    () => (contact ? [contact.company, ...contact.affiliations.map((a) => a.company)] : []),
    [contact]
  );

  const linkMatches = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    const linkedIds = new Set(linkedCompanies.map((c) => c.id));
    return companies.filter((c) => !linkedIds.has(c.id) && (!q || c.name.toLowerCase().includes(q))).slice(0, 10);
  }, [companies, linkQuery, linkedCompanies]);

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error();
  };

  const saveEdit = async () => {
    try {
      const { firstName, lastName, title, email, linkedinUrl, phone, location, notes, companyId } = editForm;
      const movedCompany = contact && companyId && companyId !== contact.companyId;
      await patch({ firstName, lastName, title, email, linkedinUrl, phone, location, notes, companyId });
      toast(movedCompany
        ? { title: "Saved", description: `${contact.company.name} kept as a former role.` }
        : { title: "Saved" });
      setEditMode(false);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save contact.", variant: "destructive" });
    }
  };

  const setRelationship = async (relationship: string) => {
    if (!contact) return;
    setContact({ ...contact, relationship });
    await patch({ relationship }).catch(() => load());
  };

  const linkCompany = async () => {
    const res = await fetch(`/api/contacts/${id}/affiliations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: linkCompanyId, role: linkRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Could not link company", description: data.error, variant: "destructive" });
      return;
    }
    setShowLink(false); setLinkCompanyId(""); setLinkRole(""); setLinkQuery("");
    load();
  };

  const unlinkCompany = async (companyId: string) => {
    await fetch(`/api/contacts/${id}/affiliations?companyId=${companyId}`, { method: "DELETE" });
    load();
  };

  const logActivity = async () => {
    if (!contact) return;
    const res = await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...logForm, companyId: logForm.companyId || contact.companyId, contactId: contact.id }),
    });
    if (!res.ok) {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
      return;
    }
    toast({ title: "Activity logged" });
    setShowLog(false);
    setLogForm({ type: "CALL", direction: "OUTBOUND", subject: "", content: "", followUpDate: "", companyId: "" });
    load();
  };

  const deleteContact = async () => {
    if (!contact || !confirm(`Delete ${contact.firstName} ${contact.lastName}? Their logged activity stays on the company records.`)) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    toast({ title: "Contact deleted" });
    router.push("/contacts");
  };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading...</div>;
  if (!contact) return (
    <div className="p-4 sm:p-8 text-center text-slate-500">
      Contact not found. <Link href="/contacts" className="text-blue-600 hover:underline">Back to contacts</Link>
    </div>
  );

  const field = (key: keyof Contact) => ({
    value: (editForm[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/contacts">
            <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
          </Link>
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
            {contact.firstName[0]}{contact.lastName[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{contact.firstName} {contact.lastName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {contact.title ? `${contact.title} at ` : ""}
              <Link href={`/companies/${contact.company.id}`} className="text-blue-600 hover:underline">{contact.company.name}</Link>
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
              {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-blue-600"><Mail size={13} />{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone size={13} />{contact.phone}</a>}
              {contact.location && <span className="flex items-center gap-1"><MapPin size={13} />{contact.location}</span>}
              {contact.linkedinUrl && <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600"><Linkedin size={13} />LinkedIn</a>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setEditForm(contact); }}><X size={14} /> Cancel</Button>
              <Button size="sm" onClick={saveEdit}><Save size={14} /> Save</Button>
            </>
          ) : (
            <>
              <Link href={`/outreach?companyId=${contact.company.id}`}>
                <Button variant="outline" size="sm"><Send size={14} /> Outreach</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit</Button>
              <Button variant="outline" size="sm" onClick={deleteContact} className="text-red-600 hover:bg-red-50"><Trash2 size={14} /></Button>
            </>
          )}
        </div>
      </div>

      {/* Relationship */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-slate-500 font-medium">Relationship:</span>
        <div className="flex gap-2 flex-wrap">
          {RELATIONSHIP_STRENGTHS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRelationship(r.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                contact.relationship === r.value ? `${r.color} font-semibold` : "border-slate-200 text-slate-500 hover:border-slate-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left column: details + companies */}
        <div className="lg:col-span-2 space-y-5">
          {editMode && (
            <Card>
              <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input className="mt-1" {...field("firstName")} /></div>
                  <div><Label>Last Name</Label><Input className="mt-1" {...field("lastName")} /></div>
                </div>
                <div><Label>Title</Label><Input className="mt-1" {...field("title")} /></div>
                <div>
                  <Label>Current Company</Label>
                  <Select value={(editForm.companyId as string) ?? contact.companyId} onValueChange={(v) => setEditForm((f) => ({ ...f, companyId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(companies.length ? companies : [contact.company]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editForm.companyId && editForm.companyId !== contact.companyId && (
                    <p className="text-[11px] text-slate-500 mt-1">{contact.company.name} will be kept as a former role.</p>
                  )}
                </div>
                <div><Label>Email</Label><Input className="mt-1" type="email" {...field("email")} /></div>
                <div><Label>Phone</Label><Input className="mt-1" {...field("phone")} /></div>
                <div><Label>Location</Label><Input className="mt-1" placeholder="e.g. NYC" {...field("location")} /></div>
                <div><Label>LinkedIn URL</Label><Input className="mt-1" {...field("linkedinUrl")} /></div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Companies</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowLink(true)}><Plus size={14} /> Link</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/companies/${contact.company.id}`} className="block rounded-lg border border-blue-100 bg-blue-50/50 p-3 hover:bg-blue-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5"><Building2 size={13} className="text-slate-400" />{contact.company.name}</p>
                  <CompanyTypePill type={contact.company.companyType} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current{contact.title ? ` · ${contact.title}` : ""}
                  {isOperatingCompany(contact.company.companyType) && ` · ${getStatusConfig(contact.company.status).label}`}
                </p>
              </Link>
              {contact.affiliations.map((a) => (
                <div key={a.id} className="group flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                  <Link href={`/companies/${a.company.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.company.name}</p>
                      <CompanyTypePill type={a.company.companyType} />
                    </div>
                    {a.role && <p className="text-xs text-slate-500 mt-0.5">{a.role}</p>}
                  </Link>
                  <button onClick={() => unlinkCompany(a.company.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500" title="Unlink">
                    <Unlink size={13} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              {editMode ? (
                <Textarea rows={5} placeholder="How you know them, what they care about, intro paths…" {...field("notes")} />
              ) : contact.notes ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
              ) : (
                <button onClick={() => setEditMode(true)} className="text-sm text-slate-400 hover:text-blue-600">Add notes — how you know them, intro paths…</button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: activity across all companies */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activity ({contact.interactions.length})</CardTitle>
                <Button size="sm" onClick={() => setShowLog(true)}><Plus size={14} /> Log Activity</Button>
              </div>
            </CardHeader>
            <CardContent>
              {contact.interactions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No activity logged with {contact.firstName} yet</p>
              ) : (
                <div className="space-y-3">
                  {contact.interactions.map((i) => (
                    <div key={i.id} className="flex gap-3 p-3 rounded-lg border border-slate-100">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        {TYPE_ICON[i.type] ?? <StickyNote size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{i.subject || INTERACTION_TYPES.find((t) => t.value === i.type)?.label}</p>
                          <span className="text-xs text-slate-400 shrink-0">{format(new Date(i.date), "MMM d, yyyy")}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {i.direction === "INBOUND" ? "Inbound" : "Outbound"} · re{" "}
                          <Link href={`/companies/${i.company.id}`} className="text-blue-600 hover:underline">{i.company.name}</Link>
                        </p>
                        {i.content && <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap">{i.content}</p>}
                        {i.followUpDate && (
                          <p className={`text-xs mt-1.5 ${i.followUpDone ? "text-slate-400 line-through" : "text-amber-600"}`}>
                            Follow up {format(new Date(i.followUpDate), "MMM d")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Link company dialog */}
      <Dialog open={showLink} onOpenChange={(o) => { setShowLink(o); if (!o) { setLinkCompanyId(""); setLinkRole(""); setLinkQuery(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link {contact.firstName} to another company</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input autoFocus placeholder="Search companies…" value={linkQuery} onChange={(e) => { setLinkQuery(e.target.value); setLinkCompanyId(""); }} />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {linkMatches.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No matching companies. <Link href="/companies/new" className="text-blue-600 hover:underline">Add one</Link>
                </p>
              ) : linkMatches.map((c) => (
                <button key={c.id} onClick={() => setLinkCompanyId(c.id)}
                  className={`w-full flex items-center justify-between text-left rounded-md px-3 py-2 text-sm ${linkCompanyId === c.id ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-slate-50"}`}>
                  {c.name} <CompanyTypePill type={c.companyType} />
                </button>
              ))}
            </div>
            <div>
              <Label>Role</Label>
              <Input className="mt-1" placeholder="Board Member, Investor, Advisor, Former CFO, Banker on deal…" value={linkRole} onChange={(e) => setLinkRole(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLink(false)}>Cancel</Button>
            <Button onClick={linkCompany} disabled={!linkCompanyId}>Link Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log activity dialog */}
      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Activity with {contact.firstName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={logForm.type} onValueChange={(v) => setLogForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={logForm.direction} onValueChange={(v) => setLogForm((f) => ({ ...f, direction: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem>
                    <SelectItem value="INBOUND">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {linkedCompanies.length > 1 && (
              <div>
                <Label>Regarding</Label>
                <Select value={logForm.companyId || contact.companyId} onValueChange={(v) => setLogForm((f) => ({ ...f, companyId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{linkedCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Subject</Label><Input className="mt-1" value={logForm.subject} onChange={(e) => setLogForm((f) => ({ ...f, subject: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea className="mt-1" rows={4} value={logForm.content} onChange={(e) => setLogForm((f) => ({ ...f, content: e.target.value }))} /></div>
            <div><Label>Follow-up date</Label><Input className="mt-1" type="date" value={logForm.followUpDate} onChange={(e) => setLogForm((f) => ({ ...f, followUpDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLog(false)}>Cancel</Button>
            <Button onClick={logActivity}>Log Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
