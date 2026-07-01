"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { COMPANY_STATUSES, SECTORS, STAGES, PRIORITIES } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export default function NewCompanyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    website: "",
    description: "",
    sector: "",
    subSector: "",
    geography: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const company = await res.json();
      toast({ title: "Company added", description: `${form.name} added to your database.` });
      router.push(`/companies/${company.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to save company.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
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
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  className="mt-1"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={set("name")}
                  required
                />
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
                <Select value={form.sector || "NONE"} onValueChange={(v) => setForm((f) => ({ ...f, sector: v === "NONE" ? "" : v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">— Select sector —</SelectItem>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financials & Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
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
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline & Sourcing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
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

        <div className="flex gap-3 justify-end">
          <Link href="/companies">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : "Add Company"}
          </Button>
        </div>
      </form>
    </div>
  );
}
