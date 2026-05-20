export interface KPIBand {
  min: number | null; // null = no lower bound
  max: number | null; // null = no upper bound
  score: number;      // 1–10
  label: string;
}

export interface KPIDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  higherIsBetter: boolean;
  weight: number; // fraction of composite, sums to 1.0 across all KPIs
  bands: KPIBand[];
  placeholder: string;
}

export interface KPIScore {
  key: string;
  name: string;
  value: number;
  score: number;
  label: string;
  weight: number;
}

export const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    key: "arrGrowth",
    name: "ARR Growth",
    description: "Year-over-year ARR growth rate",
    unit: "%",
    higherIsBetter: true,
    weight: 0.20,
    placeholder: "e.g. 85",
    bands: [
      { min: 100, max: null,  score: 10, label: "Exceptional (≥100%)" },
      { min: 80,  max: 100,   score: 9,  label: "Excellent (80–99%)" },
      { min: 60,  max: 80,    score: 8,  label: "Strong (60–79%)" },
      { min: 50,  max: 60,    score: 7,  label: "Good (50–59%)" },
      { min: 40,  max: 50,    score: 6,  label: "Solid (40–49%)" },
      { min: 30,  max: 40,    score: 5,  label: "Moderate (30–39%)" },
      { min: 20,  max: 30,    score: 4,  label: "Below avg (20–29%)" },
      { min: 10,  max: 20,    score: 3,  label: "Weak (10–19%)" },
      { min: 0,   max: 10,    score: 2,  label: "Very weak (0–9%)" },
      { min: null, max: 0,    score: 1,  label: "Declining (<0%)" },
    ],
  },
  {
    key: "ndr",
    name: "NDR",
    description: "Net Dollar Retention — expansion minus churn on existing cohort",
    unit: "%",
    higherIsBetter: true,
    weight: 0.20,
    placeholder: "e.g. 118",
    bands: [
      { min: 130, max: null,  score: 10, label: "World-class (≥130%)" },
      { min: 120, max: 130,   score: 9,  label: "Exceptional (120–129%)" },
      { min: 110, max: 120,   score: 8,  label: "Excellent (110–119%)" },
      { min: 105, max: 110,   score: 7,  label: "Strong (105–109%)" },
      { min: 100, max: 105,   score: 6,  label: "Good (100–104%)" },
      { min: 95,  max: 100,   score: 5,  label: "Acceptable (95–99%)" },
      { min: 90,  max: 95,    score: 4,  label: "Below avg (90–94%)" },
      { min: 80,  max: 90,    score: 3,  label: "Weak (80–89%)" },
      { min: 70,  max: 80,    score: 2,  label: "Poor (70–79%)" },
      { min: null, max: 70,   score: 1,  label: "Very poor (<70%)" },
    ],
  },
  {
    key: "gdr",
    name: "GDR",
    description: "Gross Dollar Retention — revenue retained before expansion",
    unit: "%",
    higherIsBetter: true,
    weight: 0.15,
    placeholder: "e.g. 93",
    bands: [
      { min: 95,   max: null,  score: 10, label: "Exceptional (≥95%)" },
      { min: 92.5, max: 95,    score: 9,  label: "Excellent (92.5–95%)" },
      { min: 90,   max: 92.5,  score: 8,  label: "Strong (90–92.5%)" },
      { min: 87.5, max: 90,    score: 7,  label: "Good (87.5–90%)" },
      { min: 85,   max: 87.5,  score: 6,  label: "Solid (85–87.5%)" },
      { min: 82.5, max: 85,    score: 5,  label: "Moderate (82.5–85%)" },
      { min: 80,   max: 82.5,  score: 4,  label: "Below avg (80–82.5%)" },
      { min: 75,   max: 80,    score: 3,  label: "Weak (75–80%)" },
      { min: 70,   max: 75,    score: 2,  label: "Poor (70–75%)" },
      { min: null, max: 70,    score: 1,  label: "Very poor (<70%)" },
    ],
  },
  {
    key: "logoRetention",
    name: "Logo Retention",
    description: "% of customers retained year-over-year",
    unit: "%",
    higherIsBetter: true,
    weight: 0.10,
    placeholder: "e.g. 91",
    bands: [
      { min: 95,   max: null,  score: 10, label: "Exceptional (≥95%)" },
      { min: 92.5, max: 95,    score: 9,  label: "Excellent (92.5–95%)" },
      { min: 90,   max: 92.5,  score: 8,  label: "Strong (90–92.5%)" },
      { min: 87.5, max: 90,    score: 7,  label: "Good (87.5–90%)" },
      { min: 85,   max: 87.5,  score: 6,  label: "Solid (85–87.5%)" },
      { min: 82.5, max: 85,    score: 5,  label: "Moderate (82.5–85%)" },
      { min: 80,   max: 82.5,  score: 4,  label: "Below avg (80–82.5%)" },
      { min: 75,   max: 80,    score: 3,  label: "Weak (75–80%)" },
      { min: null, max: 75,    score: 2,  label: "Poor (<75%)" },
    ],
  },
  {
    key: "grossMargin",
    name: "Gross Margin",
    description: "Gross profit as a % of revenue",
    unit: "%",
    higherIsBetter: true,
    weight: 0.15,
    placeholder: "e.g. 75",
    bands: [
      { min: 80, max: null,  score: 10, label: "World-class (≥80%)" },
      { min: 75, max: 80,    score: 9,  label: "Excellent (75–80%)" },
      { min: 70, max: 75,    score: 8,  label: "Strong (70–75%)" },
      { min: 65, max: 70,    score: 7,  label: "Good (65–70%)" },
      { min: 60, max: 65,    score: 6,  label: "Solid (60–65%)" },
      { min: 55, max: 60,    score: 5,  label: "Moderate (55–60%)" },
      { min: 50, max: 55,    score: 4,  label: "Below avg (50–55%)" },
      { min: 45, max: 50,    score: 3,  label: "Weak (45–50%)" },
      { min: 40, max: 45,    score: 2,  label: "Poor (40–45%)" },
      { min: null, max: 40,  score: 1,  label: "Very poor (<40%)" },
    ],
  },
  {
    key: "ruleOf40",
    name: "Rule of 40",
    description: "ARR growth % + FCF margin % — efficiency benchmark",
    unit: "",
    higherIsBetter: true,
    weight: 0.10,
    placeholder: "e.g. 55",
    bands: [
      { min: 60, max: null,  score: 10, label: "Exceptional (≥60)" },
      { min: 50, max: 60,    score: 9,  label: "Excellent (50–60)" },
      { min: 40, max: 50,    score: 8,  label: "Strong (40–50)" },
      { min: 30, max: 40,    score: 7,  label: "Good (30–40)" },
      { min: 20, max: 30,    score: 6,  label: "Solid (20–30)" },
      { min: 10, max: 20,    score: 5,  label: "Moderate (10–20)" },
      { min: 0,  max: 10,    score: 4,  label: "Below avg (0–10)" },
      { min: -10, max: 0,   score: 3,  label: "Weak (-10–0)" },
      { min: null, max: -10, score: 2,  label: "Poor (<-10)" },
    ],
  },
  {
    key: "burnMultiple1yr",
    name: "Burn Multiple (1yr)",
    description: "Net cash burned ÷ net new ARR added in past 12 months",
    unit: "×",
    higherIsBetter: false,
    weight: 0.05,
    placeholder: "e.g. 1.4",
    bands: [
      { min: null, max: 0,   score: 10, label: "Profitable (≤0)" },
      { min: 0,    max: 0.5, score: 9,  label: "Exceptional (0–0.5×)" },
      { min: 0.5,  max: 1.0, score: 8,  label: "Excellent (0.5–1.0×)" },
      { min: 1.0,  max: 1.5, score: 7,  label: "Good (1.0–1.5×)" },
      { min: 1.5,  max: 2.0, score: 6,  label: "Solid (1.5–2.0×)" },
      { min: 2.0,  max: 2.5, score: 5,  label: "Moderate (2.0–2.5×)" },
      { min: 2.5,  max: 3.0, score: 4,  label: "Below avg (2.5–3.0×)" },
      { min: 3.0,  max: 4.0, score: 3,  label: "Weak (3.0–4.0×)" },
      { min: 4.0,  max: 5.0, score: 2,  label: "Poor (4.0–5.0×)" },
      { min: 5.0,  max: null, score: 1, label: "Very poor (>5.0×)" },
    ],
  },
  {
    key: "burnMultipleLtd",
    name: "Burn Multiple (LTD)",
    description: "Total cumulative cash burned ÷ current ARR",
    unit: "×",
    higherIsBetter: false,
    weight: 0.05,
    placeholder: "e.g. 2.8",
    bands: [
      { min: null, max: 0,    score: 10, label: "Profitable (≤0)" },
      { min: 0,    max: 1.0,  score: 9,  label: "Exceptional (0–1.0×)" },
      { min: 1.0,  max: 1.5,  score: 8,  label: "Excellent (1.0–1.5×)" },
      { min: 1.5,  max: 2.0,  score: 7,  label: "Good (1.5–2.0×)" },
      { min: 2.0,  max: 3.0,  score: 6,  label: "Solid (2.0–3.0×)" },
      { min: 3.0,  max: 4.0,  score: 5,  label: "Moderate (3.0–4.0×)" },
      { min: 4.0,  max: 5.0,  score: 4,  label: "Below avg (4.0–5.0×)" },
      { min: 5.0,  max: 7.0,  score: 3,  label: "Weak (5.0–7.0×)" },
      { min: 7.0,  max: 10.0, score: 2,  label: "Poor (7.0–10.0×)" },
      { min: 10.0, max: null,  score: 1,  label: "Very poor (>10.0×)" },
    ],
  },
];

export function scoreKPI(def: KPIDefinition, value: number): KPIBand | null {
  for (const band of def.bands) {
    const aboveMin = band.min === null || value >= band.min;
    const belowMax = band.max === null || value < band.max;
    if (aboveMin && belowMax) return band;
  }
  return null;
}

export function computeUnderwriteScore(
  values: Partial<Record<string, number>>
): { composite: number | null; kpis: KPIScore[] } {
  const kpis: KPIScore[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const def of KPI_DEFINITIONS) {
    const value = values[def.key];
    if (value === undefined || value === null || isNaN(value)) continue;
    const band = scoreKPI(def, value);
    if (!band) continue;
    kpis.push({ key: def.key, name: def.name, value, score: band.score, label: band.label, weight: def.weight });
    weightedSum += band.score * def.weight;
    totalWeight += def.weight;
  }

  const composite = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : null;

  return { composite, kpis };
}
