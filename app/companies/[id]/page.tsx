"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft, ExternalLink, Linkedin, Mail, Phone, Calendar,
  Plus, Pencil, Trash2, Save, X, Send, StickyNote, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ThesisFitPanel from "@/components/companies/ThesisFitPanel";
import FeedbackButton from "@/components/companies/FeedbackButton";
import ResearchTab from "@/components/companies/ResearchTab";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  getStatusConfig, formatARR, formatGrowth, scoreColor, scoreBg,
  COMPANY_STATUSES, SECTORS, STAGES, INTERACTION_TYPES,
} from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface ScoreDetail {
  id: string;
  score: number;
  notes: string | null;
  criterionId: string;
  criterion: { id: string; name: string; description: string | null; weight: number; minThreshold: number };
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  isPrimary: boolean;
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  date: string;
  followUpDate: string | null;
  followUpDone: boolean;
  contact: { firstName: string; lastName: string } | null;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  sector: string | null;
  subSector: string | null;
  geography: string | null;
  arrEstimate: number | null;
  arrGrowth: number | null;
  nrrEstimate: number | null;
  grossMargin: number | null;
  employees: number | null;
  founded: number | null;
  stage: string | null;
  status: string;
  priority: string;
  source: string | null;
  linkedinUrl: string | null;
  crunchbaseUrl: string | null;
  totalScore: number | null;
  thesisFitScore: number | null;
  totalFundingM: number | null;
  isIndependent: boolean | null;
  hasNoTier1VC: boolean | null;
  founderMajority: boolean | null;
  contacts: Contact[];
  interactions: Interaction[];
  scoreDetails: ScoreDetail[];
  notes: Note[];
  feedback?: { signal: string }[];
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  LINKEDIN_MESSAGE: <Linkedin size={14} />,
  CALL: <Phone size={14} />,
  MEETING: <Calendar size={14} />,
  NOTE: <StickyNote size={14} />,
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [criteria, setCriteria] = useState<ScoreDetail["criterion"][]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [scores, setScores] = useState<Record<string, { score: string; notes: string }>>({});
  const [savingScore, setSavingScore] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", title: "", email: "", linkedinUrl: "", isPrimary: false });
  const [interactionForm, setInteractionForm] = useState({ type: "EMAIL", direction: "OUTBOUND", subject: "", content: "", followUpDate: "" });
  const [noteText, setNoteText] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/companies/${id}`).then((r) => r.json()),
      fetch("/api/criteria").then((r) => r.json()),
    ]).then(([co, crits]) => {
      setCompany(co);
      setCriteria(crits);
      const initialScores: Record<string, { score: string; notes: string }> = {};
      (co.scoreDetails as ScoreDetail[]).forEach((sd) => {
        initialScores[sd.criterionId] = { score: sd.score.toString(), notes: sd.notes ?? "" };
      });
      setScores(initialScores);
      setEditForm(co);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    try {
      await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      toast({ title: "Saved", description: "Company updated." });
      setEditMode(false);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    }
  };

  const saveScores = async () => {
    setSavingScore(true);
    try {
      const scoreArray = Object.entries(scores)
        .filter(([, v]) => v.score !== "")
        .map(([criterionId, v]) => ({
          criterionId,
          score: parseFloat(v.score),
          notes: v.notes || undefined,
        }));

      const res = await fetch(`/api/companies/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: scoreArray }),
      });
      const data = await res.json();
      toast({ title: "Scores saved", description: `Total score: ${data.totalScore?.toFixed(1)}` });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save scores.", variant: "destructive" });
    } finally {
      setSavingScore(false);
    }
  };

  const addContact = async () => {
    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, companyId: id }),
      });
      toast({ title: "Contact added" });
      setShowAddContact(false);
      setContactForm({ firstName: "", lastName: "", title: "", email: "", linkedinUrl: "", isPrimary: false });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
    }
  };

  const addInteraction = async () => {
    try {
      await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...interactionForm, companyId: id }),
      });
      toast({ title: "Activity logged" });
      setShowAddInteraction(false);
      setInteractionForm({ type: "EMAIL", direction: "OUTBOUND", subject: "", content: "", followUpDate: "" });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText, companyId: id }),
      });
      setNoteText("");
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
    }
  };

  const deleteCompany = async () => {
    if (!confirm(`Delete ${company?.name}? This cannot be undone.`)) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    router.push("/companies");
  };

  const statusChange = async (newStatus: string) => {
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading...</div>
  );

  if (!company) return (
    <div className="p-8 text-slate-500">Company not found.</div>
  );

  const statusConfig = getStatusConfig(company.status);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            {editMode ? (
              <Input
                className="text-2xl font-bold h-auto py-1 text-slate-900 border-blue-300"
                value={(editForm.name as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={`${statusConfig.color} border-0`}>{statusConfig.label}</Badge>
              {company.sector && (
                <span className="text-sm text-slate-500">{company.sector}</span>
              )}
              {company.stage && (
                <span className="text-sm text-slate-400">· {company.stage}</span>
              )}
              {company.geography && (
                <span className="text-sm text-slate-400">· {company.geography}</span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Website <ExternalLink size={12} />
                </a>
              )}
              {company.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Linkedin size={12} /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                <X size={14} /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdit}>
                <Save size={14} /> Save
              </Button>
            </>
          ) : (
            <>
              <FeedbackButton
                companyId={company.id}
                source="detail"
                currentSignal={company.feedback?.[0]?.signal as import("@/lib/thesis").FeedbackSignal | undefined}
              />
              <Link href={`/outreach?companyId=${company.id}`}>
                <Button variant="outline" size="sm">
                  <Send size={14} /> Outreach
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                <Pencil size={14} /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={deleteCompany} className="text-red-600 hover:bg-red-50">
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "ARR", value: formatARR(company.arrEstimate) },
          { label: "Growth", value: formatGrowth(company.arrGrowth) },
          { label: "NRR", value: company.nrrEstimate ? `${company.nrrEstimate}%` : "—" },
          { label: "GM", value: company.grossMargin ? `${company.grossMargin}%` : "—" },
          { label: "Employees", value: company.employees?.toLocaleString() ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 px-4 py-3 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Status changer */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-slate-500 font-medium">Status:</span>
        <div className="flex gap-2 flex-wrap">
          {COMPANY_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => statusChange(s.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                company.status === s.value
                  ? `${s.color} border-current font-semibold`
                  : "border-slate-200 text-slate-500 hover:border-slate-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scoring">
            Scoring
            {company.totalScore !== null && (
              <span className={`ml-2 font-bold ${scoreColor(company.totalScore)}`}>
                {company.totalScore.toFixed(1)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({company.contacts.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({company.interactions.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({company.notes.length})</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Sector</Label>
                        <Select
                          value={(editForm.sector as string) || "NONE"}
                          onValueChange={(v) => setEditForm((f) => ({ ...f, sector: v === "NONE" ? "" : v }))}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">—</SelectItem>
                            {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Stage</Label>
                        <Select
                          value={(editForm.stage as string) || "NONE"}
                          onValueChange={(v) => setEditForm((f) => ({ ...f, stage: v === "NONE" ? "" : v }))}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">—</SelectItem>
                            {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ARR ($M)</Label>
                        <Input type="number" className="mt-1" value={(editForm.arrEstimate as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, arrEstimate: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <Label>Growth (%)</Label>
                        <Input type="number" className="mt-1" value={(editForm.arrGrowth as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, arrGrowth: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <Label>NRR (%)</Label>
                        <Input type="number" className="mt-1" value={(editForm.nrrEstimate as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, nrrEstimate: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <Label>Gross Margin (%)</Label>
                        <Input type="number" className="mt-1" value={(editForm.grossMargin as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, grossMargin: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <Label>Employees</Label>
                        <Input type="number" className="mt-1" value={(editForm.employees as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, employees: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <Label>Founded</Label>
                        <Input type="number" className="mt-1" value={(editForm.founded as number) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, founded: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea className="mt-1" rows={4} value={(editForm.description as string) ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                ) : (
                  <>
                    {company.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">{company.description}</p>
                    )}
                    <Separator />
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ["Founded", company.founded ?? "—"],
                        ["Stage", company.stage ?? "—"],
                        ["Geography", company.geography ?? "—"],
                        ["Sub-sector", company.subSector ?? "—"],
                        ["Source", company.source ?? "—"],
                        ["Priority", company.priority],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <dt className="text-slate-400 text-xs">{label}</dt>
                          <dd className="font-medium text-slate-700">{value as string}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Thesis Fit
                  {company.thesisFitScore !== null && (
                    <span className={`text-sm font-bold ${company.thesisFitScore < 0 ? "text-red-600" : company.thesisFitScore >= 75 ? "text-emerald-600" : company.thesisFitScore >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                      {company.thesisFitScore < 0 ? "Fails Filters" : `${company.thesisFitScore}%`}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ThesisFitPanel companyId={company.id} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Investment Score</CardTitle></CardHeader>
              <CardContent>
                {company.totalScore !== null ? (
                  <div className="text-center mb-4">
                    <span className={`text-5xl font-black ${scoreColor(company.totalScore)}`}>
                      {company.totalScore.toFixed(1)}
                    </span>
                    <span className="text-slate-400 text-lg">/10</span>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 text-sm mb-4">Not yet scored</p>
                )}
                <div className="space-y-2">
                  {company.scoreDetails.map((sd) => (
                    <div key={sd.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">{sd.criterion.name}</span>
                        <span className={`font-bold ${scoreColor(sd.score)}`}>{sd.score.toFixed(1)}</span>
                      </div>
                      <Progress value={sd.score * 10} className="h-1.5" />
                    </div>
                  ))}
                  {company.scoreDetails.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">
                      Go to the Scoring tab to score this company
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Investment Criteria Scoring</CardTitle>
                <Button size="sm" onClick={saveScores} disabled={savingScore}>
                  <Save size={14} />
                  {savingScore ? "Saving..." : "Save Scores"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {criteria.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No criteria configured.{" "}
                  <Link href="/settings" className="text-blue-600 hover:underline">
                    Set up criteria in Settings
                  </Link>
                </p>
              ) : (
                <div className="space-y-6">
                  {criteria.map((criterion) => {
                    const current = scores[criterion.id] ?? { score: "", notes: "" };
                    const numScore = parseFloat(current.score);
                    const hasScore = current.score !== "" && !isNaN(numScore);
                    return (
                      <div key={criterion.id} className={`rounded-lg border p-4 ${hasScore ? scoreBg(numScore) : "bg-slate-50 border-slate-200"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-800">{criterion.name}</h3>
                              <span className="text-xs text-slate-400">
                                weight: {(criterion.weight * 100).toFixed(0)}%
                              </span>
                            </div>
                            {criterion.description && (
                              <p className="text-xs text-slate-500 mb-3">{criterion.description}</p>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                  <button
                                    key={n}
                                    onClick={() =>
                                      setScores((s) => ({
                                        ...s,
                                        [criterion.id]: { ...current, score: n.toString() },
                                      }))
                                    }
                                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                                      hasScore && numScore >= n
                                        ? numScore >= 8
                                          ? "bg-emerald-500 text-white"
                                          : numScore >= 6
                                          ? "bg-green-500 text-white"
                                          : numScore >= 4
                                          ? "bg-yellow-500 text-white"
                                          : "bg-red-500 text-white"
                                        : "bg-white border border-slate-200 text-slate-400 hover:border-slate-400"
                                    }`}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                              {hasScore && (
                                <span className={`text-xl font-bold ${scoreColor(numScore)}`}>
                                  {numScore.toFixed(0)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Input
                            placeholder="Notes (optional)"
                            className="text-xs bg-white"
                            value={current.notes}
                            onChange={(e) =>
                              setScores((s) => ({
                                ...s,
                                [criterion.id]: { ...current, notes: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Contacts</CardTitle>
                <Button size="sm" onClick={() => setShowAddContact(true)}>
                  <Plus size={14} /> Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No contacts yet</p>
              ) : (
                <div className="space-y-3">
                  {company.contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">
                              {c.firstName} {c.lastName}
                            </p>
                            {c.isPrimary && (
                              <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          {c.title && <p className="text-xs text-slate-500">{c.title}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-slate-400 hover:text-blue-600" title={c.email}>
                            <Mail size={16} />
                          </a>
                        )}
                        {c.linkedinUrl && (
                          <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                            <Linkedin size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activity Log</CardTitle>
                <Button size="sm" onClick={() => setShowAddInteraction(true)}>
                  <Plus size={14} /> Log Activity
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {company.interactions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No activity logged yet</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
                  <div className="space-y-4">
                    {company.interactions.map((interaction) => (
                      <div key={interaction.id} className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-500 shrink-0 z-10">
                          {TYPE_ICON[interaction.type]}
                        </div>
                        <div className="flex-1 bg-white border border-slate-100 rounded-lg p-3 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                {interaction.type.replace("_", " ")}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${interaction.direction === "INBOUND" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                {interaction.direction}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {format(new Date(interaction.date), "MMM d, yyyy")}
                            </span>
                          </div>
                          {interaction.subject && (
                            <p className="text-sm font-medium text-slate-800 mb-1">{interaction.subject}</p>
                          )}
                          {interaction.content && (
                            <p className="text-xs text-slate-500 line-clamp-3">{interaction.content}</p>
                          )}
                          {interaction.followUpDate && !interaction.followUpDone && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                              <Calendar size={11} />
                              Follow-up: {format(new Date(interaction.followUpDate), "MMM d")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-5">
                <Textarea
                  placeholder="Add a note..."
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button onClick={addNote} disabled={!noteText.trim()} className="shrink-0">
                  <Plus size={14} /> Add
                </Button>
              </div>
              {company.notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {company.notes.map((note) => (
                    <div key={note.id} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {format(new Date(note.createdAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Research Tab */}
        <TabsContent value="research">
          <ResearchTab
            companyId={company.id}
            companyName={company.name}
            domain={company.website}
          />
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input className="mt-1" value={contactForm.firstName} onChange={(e) => setContactForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input className="mt-1" value={contactForm.lastName} onChange={(e) => setContactForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input className="mt-1" placeholder="CEO, CTO, VP Sales..." value={contactForm.title} onChange={(e) => setContactForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>LinkedIn URL</Label>
              <Input className="mt-1" value={contactForm.linkedinUrl} onChange={(e) => setContactForm((f) => ({ ...f, linkedinUrl: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
            <Button onClick={addContact} disabled={!contactForm.firstName || !contactForm.lastName}>
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Interaction Dialog */}
      <Dialog open={showAddInteraction} onOpenChange={setShowAddInteraction}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={interactionForm.type} onValueChange={(v) => setInteractionForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={interactionForm.direction} onValueChange={(v) => setInteractionForm((f) => ({ ...f, direction: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem>
                    <SelectItem value="INBOUND">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Subject / Title</Label>
              <Input className="mt-1" value={interactionForm.subject} onChange={(e) => setInteractionForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label>Notes / Content</Label>
              <Textarea className="mt-1" rows={4} value={interactionForm.content} onChange={(e) => setInteractionForm((f) => ({ ...f, content: e.target.value }))} />
            </div>
            <div>
              <Label>Follow-up Date</Label>
              <Input className="mt-1" type="date" value={interactionForm.followUpDate} onChange={(e) => setInteractionForm((f) => ({ ...f, followUpDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInteraction(false)}>Cancel</Button>
            <Button onClick={addInteraction}>Log Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
