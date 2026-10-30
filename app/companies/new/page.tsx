"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Ban, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_STATUSES, SECTORS, STAGES, PRIORITIES, COMPANY_TYPES, isOperatingCompany } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ScoreBadge } from "@/components/sourcing/shared";
import { researchCompany, saveResearchedCompany, type ResearchedCompany } from "@/lib/companyResearch";

export default function NewCompanyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    companyType: "OPERATING_COMPANY",
    website: "",
    description: "",
    sector: "",
    subSector: "",
    geography: "",
    totalFundingM: "",
    arrEstimate: "",
    arrGrowth: "",
    nrrEstimate: "",
    grossMargin: "",
    employees: "",
    founded: "",
    stage: "",
    status: "IDENTIFIED",
    priority: "UNKNOWN",
    source: "",
    linkedinUrl: "",
    crunchbaseUrl: "",
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setSelect = (key: string) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isOperating = isOperatingCompany(form.companyType);
  const [lookup, setLookup] = useState("");
  const [researching, setResearching] = useState(false);
  const [research, setResearch] = useState<ResearchedCompany | null>(null);
  const [autoResearch, setAutoResearch] = useState(true);

  // Fill only fields the user hasn't typed into — their entries always win.
  const applyResearch = (r: ResearchedCompany) => {
    const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    setForm((f) => {
      const pick = (key: keyof typeof f, value: unknown) => (f[key] ? f[key] : str(value));
      return {
        ...f,
        name: f.name || r.name,
        website: pick("website", r.website),
        description: pick("description", r.description),
        sector: pick("sector", r.sector),
        subSector: pick("subSector", r.subSector),
        geography: pick("geography", r.geography),
        founded: pick("founded", r.founded),
        stage: pick("stage", r.stage),
        totalFundingM: pick("totalFundingM", r.totalFundingM),
        employees: pick("employees", r.employees),
        arrEstimate: pick("arrEstimate", r.arrEstimate),
        arrGrowth: pick("arrGrowth", r.arrGrowth),
        nrrEstimate: pick("nrrEstimate", r.nrrEstimate),
        grossMargin: pick("grossMargin", r.grossMargin),
      };
    });
  };

  const runResearch = async (query: string): Promise<ResearchedCompany | null> => {
    if (!query.trim()) return null;
    setResearching(true);
    try {
      const r = await researchCompany(query);
      setResearch(r);
      applyResearch(r);
      return r;
    } catch (err) {
      toast({ title: "Couldn't research this company", description: err instanceof Error ? err.message : "Lookup failed", variant: "destructive" });
      return null;
    } finally {
      setResearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !lookup.trim()) return;

    setSaving(true);
    try {
      let r = research;
      if (!r && isOperating && autoResearch) {
        r = await runResearch(form.website || form.name || lookup);
      }
      const num = (v: string, fallback?: number | null) => (v.trim() === "" ? fallback ?? null : Number(v));
      const company: ResearchedCompany = {
        ...(r ?? {}),
        name: form.name.trim() || r?.name || lookup.trim(),
        website: form.website || r?.website || null,
        description: form.description || r?.description || null,
        sector: form.sector || r?.sector || null,
        subSector: form.subSector || r?.subSector || null,
        geography: form.geography || r?.geography || null,
        founded: num(form.founded, r?.founded),
        stage: form.stage || r?.stage || null,
        totalFundingM: num(form.totalFundingM, r?.totalFundingM),
        employees: num(form.employees, r?.employees),
        arrEstimate: num(form.arrEstimate, r?.arrEstimate),
        arrGrowth: num(form.arrGrowth, r?.arrGrowth),
        nrrEstimate: num(form.nrrEstimate, r?.nrrEstimate),
        grossMargin: num(form.grossMargin, r?.grossMargin),
      };
      const { id } = await saveResearchedCompany(company, {
        companyType: form.companyType,
        status: form.status,
        priority: form.priority,
        source: form.source || r?.source || "Added manually",
        linkedinUrl: form.linkedinUrl || null,
        crunchbaseUrl: form.crunchbaseUrl || null,
      });
      toast({
        title: "Company added",
        description: r?.founderName ? `${company.name} added — ${r.founderName} saved as primary contact.` : `${company.name} added to your database.`,
      });
      router.push(`/companies/${id}`);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save company.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/companies">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Company</h1>
          <p className="text-slate-500 text-sm">Add a new company to your database</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI lookup — same research Hunt uses */}
        {isOperating && (
          <Card className="border-violet-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles size={16} className="text-violet-500" />Look up with AI</CardTitle>
              <p className="text-sm text-slate-500">Same web research as Hunt: fills in the profile, scores thesis fit, and adds the founder as primary contact. Anything you type below takes priority.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Company name or website, e.g. clad.com"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runResearch(lookup); } }}
                />
                <Button type="button" onClick={() => runResearch(lookup)} disabled={researching || !lookup.trim()} className="bg-violet-600 hover:bg-violet-700 shrink-0">
                  {researching ? <><Loader2 size={14} className="animate-spin" /> Researching…</> : <><Sparkles size={14} /> Research</>}
                </Button>
              </div>
              {researching && <p className="text-xs text-slate-400">Searching the web and scoring against your thesis — usually 20–40 seconds.</p>}

              {research && (
                <div className={`rounded-lg border p-4 space-y-2 ${research.acquired ? "border-red-200 bg-red-50" : "border-violet-100 bg-violet-50/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{research.name}</p>
                      <p className="text-xs text-slate-500">{[research.geography, research.stage, research.founded ? `Founded ${research.founded}` : null].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={research.fitScore ?? null} />
                      <button type="button" onClick={() => setResearch(null)} className="text-slate-400 hover:text-slate-600" title="Discard research"><X size={14} /></button>
                    </div>
                  </div>
                  {research.acquired && (
                    <p className="text-sm text-red-700 flex items-center gap-1.5"><Ban size={14} /> Acquired{research.acquiredBy ? ` by ${research.acquiredBy}` : ""} — likely not investable.</p>
                  )}
                  {research.fitRationale && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-0.5">Thesis fit</p>
                      <p className="text-sm text-slate-700">{research.fitRationale}</p>
                    </div>
                  )}
                  {research.founderName && (
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <UserRound size={13} className="text-slate-400" />
                      {research.founderName}{research.founderTitle ? `, ${research.founderTitle}` : ""} — will be added as primary contact
                    </p>
                  )}
                  {research.source && <p className="text-[11px] text-slate-400">{research.source}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  className="mt-1"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={set("name")}
                />
              </div>
              <div>
                <Label>Company Type</Label>
                <Select value={form.companyType} onValueChange={setSelect("companyType")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  className="mt-1"
                  placeholder="https://acme.com"
                  value={form.website}
                  onChange={set("website")}
                />
              </div>
              <div>
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  className="mt-1"
                  list="sector-options"
                  placeholder="e.g. Vertical SaaS"
                  value={form.sector}
                  onChange={set("sector")}
                />
                <datalist id="sector-options">
                  {SECTORS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <Label htmlFor="subSector">Sub-sector</Label>
                <Input
                  id="subSector"
                  className="mt-1"
                  placeholder="e.g. Revenue Intelligence"
                  value={form.subSector}
                  onChange={set("subSector")}
                />
              </div>
              <div>
                <Label htmlFor="geography">Geography</Label>
                <Input
                  id="geography"
                  className="mt-1"
                  placeholder="e.g. North America, NYC"
                  value={form.geography}
                  onChange={set("geography")}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className="mt-1"
                  placeholder="What does this company do? What problem do they solve?"
                  rows={3}
                  value={form.description}
                  onChange={set("description")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financials */}
        {isOperating && <Card>
          <CardHeader>
            <CardTitle className="text-base">Financials & Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="totalFundingM">Total Raised ($M)</Label>
                <Input
                  id="totalFundingM"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 18"
                  value={form.totalFundingM}
                  onChange={set("totalFundingM")}
                />
              </div>
              <div>
                <Label htmlFor="arrEstimate">ARR ($M)</Label>
                <Input
                  id="arrEstimate"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 12.5"
                  value={form.arrEstimate}
                  onChange={set("arrEstimate")}
                />
              </div>
              <div>
                <Label htmlFor="arrGrowth">ARR Growth (% YoY)</Label>
                <Input
                  id="arrGrowth"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 120"
                  value={form.arrGrowth}
                  onChange={set("arrGrowth")}
                />
              </div>
              <div>
                <Label htmlFor="nrrEstimate">NRR (%)</Label>
                <Input
                  id="nrrEstimate"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 115"
                  value={form.nrrEstimate}
                  onChange={set("nrrEstimate")}
                />
              </div>
              <div>
                <Label htmlFor="grossMargin">Gross Margin (%)</Label>
                <Input
                  id="grossMargin"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 78"
                  value={form.grossMargin}
                  onChange={set("grossMargin")}
                />
              </div>
              <div>
                <Label htmlFor="employees">Employees</Label>
                <Input
                  id="employees"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 85"
                  value={form.employees}
                  onChange={set("employees")}
                />
              </div>
              <div>
                <Label htmlFor="founded">Founded</Label>
                <Input
                  id="founded"
                  type="number"
                  className="mt-1"
                  placeholder="e.g. 2019"
                  value={form.founded}
                  onChange={set("founded")}
                />
              </div>
              <div>
                <Label>Stage</Label>
                <Select value={form.stage || "NONE"} onValueChange={(v) => setForm((f) => ({ ...f, stage: v === "NONE" ? "" : v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">— Select stage —</SelectItem>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>}

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isOperating ? "Pipeline & Sourcing" : "Source & Links"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {isOperating && <>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={setSelect("status")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={setSelect("priority")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </>}
              <div>
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  className="mt-1"
                  placeholder="e.g. LinkedIn, Referral, Conference"
                  value={form.source}
                  onChange={set("source")}
                />
              </div>
              <div>
                <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                <Input
                  id="linkedinUrl"
                  className="mt-1"
                  placeholder="https://linkedin.com/company/..."
                  value={form.linkedinUrl}
                  onChange={set("linkedinUrl")}
                />
              </div>
              <div>
                <Label htmlFor="crunchbaseUrl">Crunchbase URL</Label>
                <Input
                  id="crunchbaseUrl"
                  className="mt-1"
                  placeholder="https://crunchbase.com/organization/..."
                  value={form.crunchbaseUrl}
                  onChange={set("crunchbaseUrl")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          {isOperating && !research && (
            <label className="flex items-center gap-2 text-sm text-slate-600 mr-auto">
              <input type="checkbox" checked={autoResearch} onChange={(e) => setAutoResearch(e.target.checked)} />
              Research with AI before saving
            </label>
          )}
          <Link href="/companies">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving || researching || (!form.name.trim() && !lookup.trim())}>
            {saving ? (researching ? "Researching…" : "Saving…") : "Add Company"}
          </Button>
        </div>
      </form>
    </div>
  );
}
