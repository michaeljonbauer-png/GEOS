"use client";

import { useEffect, useState } from "react";
import { Sparkles, Copy, Check, Send, Mail, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { dateInputToISO, toDateInputValue } from "@/lib/utils";
import { normalizeUrl } from "@/lib/urls";

interface OutreachContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  isPrimary?: boolean;
}

interface CompanyForOutreach {
  id: string;
  name: string;
  description: string | null;
  sector: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  contacts: OutreachContact[];
  contactAffiliations?: { role: string | null; contact: OutreachContact }[];
}

type Channel = "EMAIL" | "LINKEDIN_MESSAGE";

const SENDER_KEY = "geos.outreach.sender";

export default function OutreachDialog({
  companyId,
  defaultContactId,
  open,
  onOpenChange,
  onLogged,
}: {
  companyId: string;
  defaultContactId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged?: () => void;
}) {
  const { toast } = useToast();
  const [company, setCompany] = useState<CompanyForOutreach | null>(null);
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [contactId, setContactId] = useState("");
  const [sender, setSender] = useState({ investorName: "", firmName: "" });
  const [customContext, setCustomContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [logged, setLogged] = useState(false);
  const [sentOn, setSentOn] = useState(toDateInputValue(new Date()));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SENDER_KEY);
      if (saved) setSender(JSON.parse(saved));
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    setHasDraft(false); setSubject(""); setBody(""); setLogged(false); setCustomContext("");
    fetch(`/api/companies/${companyId}`)
      .then((r) => r.json())
      .then((c: CompanyForOutreach) => {
        setCompany(c);
        const primary = c.contacts.find((k) => k.isPrimary);
        setContactId(defaultContactId ?? primary?.id ?? "");
      });
  }, [open, companyId, defaultContactId]);

  const contacts: (OutreachContact & { note?: string })[] = company
    ? [
        ...company.contacts.map((c) => ({ ...c, note: c.title ?? undefined })),
        ...(company.contactAffiliations ?? []).map((a) => ({ ...a.contact, note: a.role ?? undefined })),
      ]
    : [];
  const contact = contacts.find((c) => c.id === contactId);

  const updateSender = (patch: Partial<typeof sender>) => {
    const next = { ...sender, ...patch };
    setSender(next);
    try { localStorage.setItem(SENDER_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const generate = async () => {
    if (!company) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: channel,
          companyName: company.name,
          companyDescription: company.description,
          sector: company.sector,
          arrEstimate: company.arrEstimate,
          arrGrowth: company.arrGrowth,
          contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
          contactTitle: contact?.title,
          investorName: sender.investorName || undefined,
          firmName: sender.firmName || undefined,
          customContext: customContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setHasDraft(true);
      setLogged(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate draft", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (text: string, field: "subject" | "body") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const logAsSent = async () => {
    const res = await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: channel,
        direction: "OUTBOUND",
        subject: subject || undefined,
        content: body,
        companyId,
        contactId: contactId || undefined,
        date: dateInputToISO(sentOn),
      }),
    });
    if (!res.ok) {
      toast({ title: "Error", description: "Failed to log outreach.", variant: "destructive" });
      return;
    }
    setLogged(true);
    toast({ title: "Logged", description: "Outreach added to the activity log." });
    onLogged?.();
  };

  const openMail = () => {
    window.open(`mailto:${contact?.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Draft outreach{company ? ` — ${company.name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(["EMAIL", "LINKEDIN_MESSAGE"] as Channel[]).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  channel === c ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                {c === "EMAIL" ? <Mail size={14} /> : <Linkedin size={14} />}
                {c === "EMAIL" ? "Email" : "LinkedIn"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>To</Label>
              <Select value={contactId || "NONE"} onValueChange={(v) => setContactId(v === "NONE" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— No specific contact —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}{c.note ? ` · ${c.note}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Your name</Label>
              <Input className="mt-1" placeholder="Jane Smith" value={sender.investorName} onChange={(e) => updateSender({ investorName: e.target.value })} />
            </div>
            <div>
              <Label>Firm name</Label>
              <Input className="mt-1" placeholder="Acme Capital" value={sender.firmName} onChange={(e) => updateSender({ firmName: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Additional context (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Specific angle, mutual connection, recent news…"
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
            />
          </div>

          <Button onClick={generate} disabled={generating || !company} className="w-full">
            <Sparkles size={16} />
            {generating ? "Generating…" : hasDraft ? "Regenerate draft" : "Generate draft with AI"}
          </Button>

          {hasDraft && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {channel === "EMAIL" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Subject</Label>
                    <button onClick={() => copy(subject, "subject")} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      {copied === "subject" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="font-medium" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-slate-500 uppercase tracking-wide">{channel === "EMAIL" ? "Body" : "Message"}</Label>
                  <button onClick={() => copy(body, "body")} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    {copied === "body" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={channel === "EMAIL" ? 12 : 6} className="text-sm leading-relaxed" />
                {channel === "LINKEDIN_MESSAGE" && (
                  <p className={`text-xs mt-1 ${body.length > 300 ? "text-red-500" : "text-slate-400"}`}>
                    {body.length} / 300 characters{body.length > 300 && " — exceeds LinkedIn connection-note limit"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Sent on
                  <Input type="date" className="h-8 w-36 text-xs" max={toDateInputValue(new Date())} value={sentOn} onChange={(e) => setSentOn(e.target.value)} disabled={logged} />
                </label>
                <Button variant="outline" size="sm" onClick={logAsSent} disabled={logged || !sentOn}>
                  {logged ? <><Check size={14} /> Logged</> : <><Send size={14} /> Log as sent</>}
                </Button>
                {channel === "EMAIL" && (
                  <Button variant="outline" size="sm" onClick={openMail}><Mail size={14} /> Open in Mail</Button>
                )}
                {contact?.linkedinUrl && (
                  <a href={normalizeUrl(contact.linkedinUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50"><Linkedin size={14} /> Open LinkedIn</Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
