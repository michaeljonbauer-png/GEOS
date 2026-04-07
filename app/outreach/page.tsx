"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, Copy, Check, Send, Mail, Linkedin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Company {
  id: string;
  name: string;
  sector: string | null;
  description: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  status: string;
  contacts: { id: string; firstName: string; lastName: string; title: string | null; email: string | null }[];
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  date: string;
  company: { id: string; name: string };
  contact: { firstName: string; lastName: string } | null;
}

function OutreachPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentOutreach, setRecentOutreach] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyId: searchParams.get("companyId") ?? "",
    contactId: "",
    type: "EMAIL" as "EMAIL" | "LINKEDIN_MESSAGE",
    investorName: "",
    firmName: "",
    customContext: "",
  });

  const [draft, setDraft] = useState<{ subject?: string; body: string } | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const selectedCompany = companies.find((c) => c.id === form.companyId);

  useEffect(() => {
    Promise.all([
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/interactions?type=EMAIL&limit=20").then((r) => r.json()),
    ]).then(([cos, interactions]) => {
      setCompanies(cos);
      setRecentOutreach(interactions.filter((i: Interaction) =>
        i.type === "EMAIL" || i.type === "LINKEDIN_MESSAGE"
      ));
    });
  }, []);

  const generateDraft = async () => {
    if (!form.companyId || !selectedCompany) return;
    setLoading(true);
    setDraft(null);

    try {
      const contact = selectedCompany.contacts.find((c) => c.id === form.contactId);
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          companyName: selectedCompany.name,
          companyDescription: selectedCompany.description,
          sector: selectedCompany.sector,
          arrEstimate: selectedCompany.arrEstimate,
          arrGrowth: selectedCompany.arrGrowth,
          contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
          contactTitle: contact?.title,
          investorName: form.investorName || undefined,
          firmName: form.firmName || undefined,
          customContext: form.customContext || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data);
      setEditedSubject(data.subject ?? "");
      setEditedBody(data.body ?? "");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate draft";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: "subject" | "body") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const logOutreach = async () => {
    if (!form.companyId || !draft) return;
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          direction: "OUTBOUND",
          subject: editedSubject || undefined,
          content: editedBody,
          companyId: form.companyId,
          contactId: form.contactId || undefined,
        }),
      });
      const data = await res.json();
      setLoggedId(data.id);
      toast({ title: "Logged!", description: "Outreach logged to activity feed." });
      // Refresh recent outreach
      fetch("/api/interactions?type=EMAIL&limit=20")
        .then((r) => r.json())
        .then((interactions) => {
          setRecentOutreach(interactions.filter((i: Interaction) =>
            i.type === "EMAIL" || i.type === "LINKEDIN_MESSAGE"
          ));
        });
    } catch {
      toast({ title: "Error", description: "Failed to log outreach.", variant: "destructive" });
    }
  };

  const openMailto = () => {
    if (!selectedCompany) return;
    const contact = selectedCompany.contacts.find((c) => c.id === form.contactId);
    const email = contact?.email ?? "";
    const subject = encodeURIComponent(editedSubject);
    const body = encodeURIComponent(editedBody);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Outreach</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          AI-powered email and LinkedIn message drafting
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Composer */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compose Outreach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "EMAIL" | "LINKEDIN_MESSAGE" }))}
              >
                <TabsList>
                  <TabsTrigger value="EMAIL">
                    <Mail size={14} className="mr-1.5" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="LINKEDIN_MESSAGE">
                    <Linkedin size={14} className="mr-1.5" /> LinkedIn
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target Company *</Label>
                  <Select
                    value={form.companyId || "NONE"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, companyId: v === "NONE" ? "" : v, contactId: "" }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">— Select company —</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Contact (optional)</Label>
                  <Select
                    value={form.contactId || "NONE"}
                    onValueChange={(v) => setForm((f) => ({ ...f, contactId: v === "NONE" ? "" : v }))}
                    disabled={!selectedCompany?.contacts.length}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">— Any/General —</SelectItem>
                      {selectedCompany?.contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                          {c.title && ` · ${c.title}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Your Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="Jane Smith"
                    value={form.investorName}
                    onChange={(e) => setForm((f) => ({ ...f, investorName: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Firm Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="Acme Capital"
                    value={form.firmName}
                    onChange={(e) => setForm((f) => ({ ...f, firmName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Additional Context (optional)</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Any specific angle, mutual connection, recent news, or context to incorporate..."
                  rows={2}
                  value={form.customContext}
                  onChange={(e) => setForm((f) => ({ ...f, customContext: e.target.value }))}
                />
              </div>

              <Button
                onClick={generateDraft}
                disabled={loading || !form.companyId}
                className="w-full"
              >
                <Sparkles size={16} />
                {loading ? "Generating..." : "Generate with Claude AI"}
              </Button>
            </CardContent>
          </Card>

          {/* Draft output */}
          {draft && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Generated Draft
                    {selectedCompany && (
                      <span className="text-slate-400 font-normal text-sm ml-2">
                        → {selectedCompany.name}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logOutreach}
                      disabled={!!loggedId}
                    >
                      {loggedId ? <><Check size={14} /> Logged</> : <><Send size={14} /> Log as Sent</>}
                    </Button>
                    {form.type === "EMAIL" && (
                      <Button variant="outline" size="sm" onClick={openMailto}>
                        <Mail size={14} /> Open in Mail
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.type === "EMAIL" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Subject</Label>
                      <button
                        onClick={() => copyToClipboard(editedSubject, "subject")}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                      >
                        {copied === "subject" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="font-medium"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">
                      {form.type === "LINKEDIN_MESSAGE" ? "Message" : "Body"}
                    </Label>
                    <button
                      onClick={() => copyToClipboard(editedBody, "body")}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      {copied === "body" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={form.type === "LINKEDIN_MESSAGE" ? 6 : 14}
                    className="font-mono text-sm leading-relaxed"
                  />
                  {form.type === "LINKEDIN_MESSAGE" && (
                    <p className="text-xs text-slate-400 mt-1">
                      {editedBody.length} / 300 characters
                      {editedBody.length > 300 && (
                        <span className="text-red-500 ml-1">— exceeds LinkedIn limit</span>
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Recent outreach */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Outreach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentOutreach.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No outreach logged yet</p>
              ) : (
                recentOutreach.slice(0, 12).map((i) => {
                  return (
                    <Link key={i.id} href={`/companies/${i.company.id}`}>
                      <div className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
                        <div className="mt-0.5 text-slate-400 shrink-0">
                          {i.type === "EMAIL" ? <Mail size={13} /> : <Linkedin size={13} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {i.company.name}
                          </p>
                          {i.subject && (
                            <p className="text-xs text-slate-500 truncate">{i.subject}</p>
                          )}
                          <p className="text-[11px] text-slate-400">
                            {format(new Date(i.date), "MMM d")}
                            {i.contact && ` · ${i.contact.firstName} ${i.contact.lastName}`}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {selectedCompany && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base text-sm">
                  <Building2 size={14} className="inline mr-1.5 text-slate-400" />
                  {selectedCompany.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500 space-y-1.5">
                {selectedCompany.sector && <p>Sector: {selectedCompany.sector}</p>}
                {selectedCompany.arrEstimate && (
                  <p>ARR: ~${selectedCompany.arrEstimate}M</p>
                )}
                {selectedCompany.arrGrowth && (
                  <p>Growth: +{selectedCompany.arrGrowth}% YoY</p>
                )}
                {selectedCompany.description && (
                  <p className="text-slate-400 pt-1 leading-relaxed line-clamp-3">
                    {selectedCompany.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutreachPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading...</div>}>
      <OutreachPage />
    </Suspense>
  );
}
