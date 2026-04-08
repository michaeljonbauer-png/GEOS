"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Save, Star, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

interface ResearchData {
  // Review platforms
  g2Url?: string | null;
  g2Rating?: number | null;
  g2ReviewCount?: number | null;
  g2Category?: string | null;
  g2Momentum?: string | null;
  capterraUrl?: string | null;
  capterraRating?: number | null;
  capterraReviewCount?: number | null;
  gartnerUrl?: string | null;
  gartnerRating?: number | null;
  gartnerReviewCount?: number | null;
  trustpilotUrl?: string | null;
  trustpilotRating?: number | null;
  trustpilotReviewCount?: number | null;
  // Web traffic
  similarwebUrl?: string | null;
  monthlyVisits?: number | null;
  trafficTrend?: string | null;
  globalRank?: number | null;
  trafficSources?: string | null;
  // Funding intelligence
  crunchbaseSlug?: string | null;
  lastFundingType?: string | null;
  lastFundingAmount?: number | null;
  lastFundingDate?: string | null;
  keyInvestors?: string | null;
  pitchbookUrl?: string | null;
  harmonicUrl?: string | null;
  grataUrl?: string | null;
  sourcescrubUrl?: string | null;
  // Market positioning
  gartnerMQUrl?: string | null;
  forresterUrl?: string | null;
  // Press / news
  recentNews?: string | null;
  // Customer evidence
  caseStudyUrl?: string | null;
  keyCustomers?: string | null;
  testimonialsUrl?: string | null;
  // Computed
  productRepScore?: number | null;
  researchNotes?: string | null;
  lastResearched?: string | null;
}

interface Props {
  companyId: string;
  companyName: string;
  domain?: string | null;
}

function repScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-gray-400";
  if (score >= 8.5) return "text-emerald-600";
  if (score >= 7.0) return "text-green-600";
  if (score >= 5.5) return "text-yellow-600";
  return "text-red-600";
}

function repScoreBg(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-gray-100 text-gray-500";
  if (score >= 8.5) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 7.0) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 5.5) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function StarRating({ rating, max = 5 }: { rating: number | null | undefined; max?: number }) {
  if (!rating) return <span className="text-gray-400 text-xs">—</span>;
  const pct = (rating / max) * 100;
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={10}
            className={i <= Math.round((rating / max) * 5) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">/ {max}</span>
    </div>
  );
}

function TrafficTrendIcon({ trend }: { trend: string | null | undefined }) {
  if (trend === "UP") return <TrendingUp size={14} className="text-green-600" />;
  if (trend === "DOWN") return <TrendingDown size={14} className="text-red-500" />;
  if (trend === "STABLE") return <Minus size={14} className="text-gray-400" />;
  return null;
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors text-gray-700"
    >
      <ExternalLink size={11} className="text-gray-400" />
      {label}
    </a>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
  );
}

export default function ResearchTab({ companyId, companyName, domain }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<ResearchData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const slug = encodeURIComponent(companyName.toLowerCase().replace(/\s+/g, "-"));
  const nameQ = encodeURIComponent(companyName);
  const domainClean = domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";

  // Auto-generated deep links for each source
  const quickLinks = [
    { label: "G2", href: `https://www.g2.com/search#query=${nameQ}&order=g2_score` },
    { label: "Capterra", href: `https://www.capterra.com/search/#q=${nameQ}` },
    { label: "Gartner Peer Insights", href: `https://www.gartner.com/reviews/search#phrase=${nameQ}` },
    { label: "Trustpilot", href: `https://www.trustpilot.com/search?query=${nameQ}` },
    {
      label: "Crunchbase",
      href: data.crunchbaseSlug
        ? `https://www.crunchbase.com/organization/${data.crunchbaseSlug}`
        : `https://www.crunchbase.com/search/organizations#field-key=facet_ids&identifier=${nameQ}`,
    },
    { label: "LinkedIn", href: `https://www.linkedin.com/search/results/companies/?keywords=${nameQ}` },
    { label: "PitchBook", href: data.pitchbookUrl ?? `https://pitchbook.com/search#q=${nameQ}&qType=all` },
    { label: "Harmonic", href: data.harmonicUrl ?? `https://app.harmonic.ai/search?query=${nameQ}` },
    { label: "Grata", href: data.grataUrl ?? `https://app.grata.com/search?q=${nameQ}` },
    { label: "SourceScrub", href: data.sourcescrubUrl ?? `https://app.sourcescrub.com/search?q=${nameQ}` },
    {
      label: "SimilarWeb",
      href: domainClean
        ? `https://www.similarweb.com/website/${domainClean}/`
        : `https://www.similarweb.com/`,
    },
    { label: "Google News", href: `https://news.google.com/search?q=${nameQ}+software` },
    { label: "Gartner Magic Quadrant", href: data.gartnerMQUrl ?? `https://www.gartner.com/en/research/magic-quadrant` },
  ];

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/research`);
      if (res.ok) {
        const json = await res.json();
        setData(json ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/research`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setData(updated);
      toast({ title: "Research saved", description: "Product rep score updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save research.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof ResearchData, value: string | number | null) =>
    setData((prev) => ({ ...prev, [field]: value === "" ? null : value }));

  const numInput = (field: keyof ResearchData, label: string, placeholder?: string) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type="number"
        step="0.1"
        placeholder={placeholder ?? "—"}
        value={data[field] ?? ""}
        onChange={(e) => set(field, e.target.value)}
        className="mt-1 h-8 text-sm"
      />
    </div>
  );

  const textInput = (field: keyof ResearchData, label: string, placeholder?: string) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type="text"
        placeholder={placeholder ?? "—"}
        value={(data[field] as string) ?? ""}
        onChange={(e) => set(field, e.target.value)}
        className="mt-1 h-8 text-sm"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        <RefreshCw size={16} className="animate-spin mr-2" /> Loading research…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Research Hub</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quick-launch source links · enter data below · score auto-computes on save
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.lastResearched && (
            <span className="text-xs text-gray-400">
              Last researched {new Date(data.lastResearched).toLocaleDateString()}
            </span>
          )}
          <Button onClick={save} disabled={saving} size="sm">
            <Save size={13} className="mr-1.5" />
            {saving ? "Saving…" : "Save Research"}
          </Button>
        </div>
      </div>

      {/* Product Reputation Score — hero card */}
      {data.productRepScore !== null && data.productRepScore !== undefined && (
        <Card className={`border ${repScoreBg(data.productRepScore)}`}>
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">Product Reputation Score</p>
                <p className="text-3xl font-bold mt-1">{data.productRepScore.toFixed(1)}<span className="text-base font-normal opacity-60"> / 10</span></p>
                <p className="text-xs opacity-70 mt-1">Log-weighted average across all review platforms</p>
              </div>
              <div className="text-right">
                <div className={`text-5xl font-black opacity-10 ${repScoreColor(data.productRepScore)}`}>
                  {data.productRepScore >= 8.5 ? "A" : data.productRepScore >= 7 ? "B" : data.productRepScore >= 5.5 ? "C" : "D"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick-launch links */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Quick-Launch Research Links</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((l) => (
              <QuickLink key={l.label} href={l.href} label={l.label} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Review Platforms ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star size={14} className="text-amber-500" />
            Review Platforms
            <span className="text-xs font-normal text-gray-400">— most important signal</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">
          {/* G2 */}
          <div>
            <SectionHeader title="G2" description="Enter the G2 profile URL and review data below" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {textInput("g2Url", "Profile URL", "https://www.g2.com/products/…")}
              {numInput("g2Rating", "Rating (0–5)", "4.7")}
              {numInput("g2ReviewCount", "Review Count", "312")}
              {textInput("g2Category", "Category", "e.g. EHS Software")}
              {textInput("g2Momentum", "Momentum Badge", "Leader / High Performer")}
            </div>
            {(data.g2Rating || data.g2ReviewCount) && (
              <div className="mt-2 flex items-center gap-3">
                <StarRating rating={data.g2Rating} />
                {data.g2ReviewCount && (
                  <span className="text-xs text-gray-500">{data.g2ReviewCount.toLocaleString()} reviews</span>
                )}
                {data.g2Momentum && <Badge variant="outline" className="text-xs">{data.g2Momentum}</Badge>}
              </div>
            )}
          </div>

          <Separator />

          {/* Capterra */}
          <div>
            <SectionHeader title="Capterra" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {textInput("capterraUrl", "Profile URL", "https://www.capterra.com/p/…")}
              {numInput("capterraRating", "Rating (0–5)", "4.8")}
              {numInput("capterraReviewCount", "Review Count", "180")}
            </div>
            {(data.capterraRating || data.capterraReviewCount) && (
              <div className="mt-2 flex items-center gap-3">
                <StarRating rating={data.capterraRating} />
                {data.capterraReviewCount && (
                  <span className="text-xs text-gray-500">{data.capterraReviewCount.toLocaleString()} reviews</span>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Gartner Peer Insights */}
          <div>
            <SectionHeader title="Gartner Peer Insights" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {textInput("gartnerUrl", "Profile URL", "https://www.gartner.com/reviews/…")}
              {numInput("gartnerRating", "Rating (0–5)", "4.6")}
              {numInput("gartnerReviewCount", "Review Count", "55")}
            </div>
            {(data.gartnerRating || data.gartnerReviewCount) && (
              <div className="mt-2 flex items-center gap-3">
                <StarRating rating={data.gartnerRating} />
                {data.gartnerReviewCount && (
                  <span className="text-xs text-gray-500">{data.gartnerReviewCount.toLocaleString()} reviews</span>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Trustpilot */}
          <div>
            <SectionHeader title="Trustpilot / Other" description="Use for B2C-adjacent or marketplace software" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {textInput("trustpilotUrl", "Profile URL", "https://www.trustpilot.com/review/…")}
              {numInput("trustpilotRating", "Rating (0–5)", "4.4")}
              {numInput("trustpilotReviewCount", "Review Count", "92")}
            </div>
            {(data.trustpilotRating || data.trustpilotReviewCount) && (
              <div className="mt-2 flex items-center gap-3">
                <StarRating rating={data.trustpilotRating} />
                {data.trustpilotReviewCount && (
                  <span className="text-xs text-gray-500">{data.trustpilotReviewCount.toLocaleString()} reviews</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Web Traffic ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-500" />
            Web Traffic
            <span className="text-xs font-normal text-gray-400">— proxy for mindshare & growth</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <SectionHeader title="SimilarWeb" description="Monthly visits, trend, and rank signal product traction" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {textInput("similarwebUrl", "SimilarWeb URL", "https://www.similarweb.com/website/…")}
            {numInput("monthlyVisits", "Monthly Visits", "48000")}
            <div>
              <Label className="text-xs text-gray-600">Traffic Trend</Label>
              <select
                value={data.trafficTrend ?? ""}
                onChange={(e) => set("trafficTrend", e.target.value)}
                className="mt-1 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">Unknown</option>
                <option value="UP">↑ Up</option>
                <option value="STABLE">→ Stable</option>
                <option value="DOWN">↓ Down</option>
              </select>
            </div>
            {numInput("globalRank", "Global Rank", "1250000")}
          </div>
          {(data.monthlyVisits || data.trafficTrend) && (
            <div className="mt-3 flex items-center gap-3">
              {data.monthlyVisits && (
                <span className="text-sm font-semibold">{data.monthlyVisits.toLocaleString()} mo/visits</span>
              )}
              {data.trafficTrend && (
                <div className="flex items-center gap-1">
                  <TrafficTrendIcon trend={data.trafficTrend} />
                  <span className="text-xs text-gray-500">{data.trafficTrend}</span>
                </div>
              )}
              {data.globalRank && (
                <span className="text-xs text-gray-500">Global rank #{data.globalRank.toLocaleString()}</span>
              )}
            </div>
          )}
          <div className="mt-3">
            <Label className="text-xs text-gray-600">Traffic Source Breakdown (optional JSON or notes)</Label>
            <Input
              placeholder='e.g. {"direct": "45%", "search": "38%", "social": "12%"}'
              value={(data.trafficSources as string) ?? ""}
              onChange={(e) => set("trafficSources", e.target.value)}
              className="mt-1 h-8 text-sm font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Funding Intelligence ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Funding Intelligence</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Crunchbase */}
          <div>
            <SectionHeader title="Crunchbase" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {textInput("crunchbaseSlug", "Slug (URL path)", "acme-corp")}
              {textInput("lastFundingType", "Last Round Type", "Seed / Series A")}
              {numInput("lastFundingAmount", "Last Round ($M)", "3.5")}
              {textInput("lastFundingDate", "Last Round Date", "2022-06")}
              {textInput("keyInvestors", "Key Investors", "Emergence, Bessemer…")}
            </div>
          </div>
          <Separator />
          {/* Other funding sources */}
          <div>
            <SectionHeader title="Other Funding Sources" description="Save profile URLs for direct access later" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {textInput("pitchbookUrl", "PitchBook URL", "https://pitchbook.com/profiles/…")}
              {textInput("harmonicUrl", "Harmonic URL", "https://app.harmonic.ai/…")}
              {textInput("grataUrl", "Grata URL", "https://app.grata.com/…")}
              {textInput("sourcescrubUrl", "SourceScrub URL", "https://app.sourcescrub.com/…")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Market Positioning ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Market Positioning</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <SectionHeader title="Analyst Coverage" description="Gartner MQ, Forrester Wave, IDC MarketScape" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {textInput("gartnerMQUrl", "Gartner Magic Quadrant URL", "https://www.gartner.com/…")}
            {textInput("forresterUrl", "Forrester Wave URL", "https://www.forrester.com/…")}
          </div>
        </CardContent>
      </Card>

      {/* ── Customer Evidence ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Customer Evidence</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {textInput("caseStudyUrl", "Case Studies URL", "https://acme.com/customers")}
            {textInput("testimonialsUrl", "Testimonials / Press Page", "https://acme.com/press")}
          </div>
          <div>
            <Label className="text-xs text-gray-600">Key Customers / Logos (comma-separated)</Label>
            <Input
              placeholder="Walmart, Siemens, Toyota…"
              value={(data.keyCustomers as string) ?? ""}
              onChange={(e) => set("keyCustomers", e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          {data.keyCustomers && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.keyCustomers.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent News ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Recent News / Press Releases</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Label className="text-xs text-gray-600">
            Paste notable headlines, links, or JSON{" "}
            <span className="text-gray-400">[{"{"}title, url, date{"}"}, …]</span>
          </Label>
          <Textarea
            placeholder={"- 2024-03: Acme Corp raises $5M Series A (TechCrunch)\n- 2023-11: Partnership with Salesforce announced"}
            value={(data.recentNews as string) ?? ""}
            onChange={(e) => set("recentNews", e.target.value)}
            rows={4}
            className="mt-1 text-sm font-mono"
          />
        </CardContent>
      </Card>

      {/* ── Research Notes ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Research Notes</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Textarea
            placeholder="General observations, competitive landscape, channel checks, open questions…"
            value={(data.researchNotes as string) ?? ""}
            onChange={(e) => set("researchNotes", e.target.value)}
            rows={5}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pb-2">
        <Button onClick={save} disabled={saving}>
          <Save size={14} className="mr-2" />
          {saving ? "Saving…" : "Save All Research"}
        </Button>
      </div>
    </div>
  );
}
