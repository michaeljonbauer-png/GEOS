// Thesis fit scoring engine
// Evaluates a company against all active ThesisCriteria and returns a structured fit result.

export interface ThesisCriterion {
  id: string;
  name: string;
  description: string | null;
  category: string; // HARD_FILTER | SIGNAL
  dataType: string; // RANGE | BOOLEAN | TEXT
  companyField: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  boolField: string | null;
  boolTarget: boolean | null;
  importance: number; // 1–5
  isActive: boolean;
  notes: string | null;
}

export interface CompanySnapshot {
  [key: string]: string | number | boolean | null | undefined;
}

export type CriterionResult =
  | { status: "PASS"; label: string }
  | { status: "FAIL"; label: string }
  | { status: "UNKNOWN"; label: string };

export interface ThesisFitResult {
  score: number | null;       // 0–100, null if no signals assessed
  hardFilterPass: boolean;    // false if any hard filter fails
  failedFilters: { id: string; name: string; reason: string }[];
  signals: {
    id: string;
    name: string;
    category: string;
    result: CriterionResult;
    importance: number;
  }[];
}

/**
 * Evaluate a company against thesis criteria.
 * Returns null for criteria where the required company data is missing.
 */
export function computeThesisFit(
  company: CompanySnapshot,
  criteria: ThesisCriterion[]
): ThesisFitResult {
  const active = criteria.filter((c) => c.isActive);
  const failedFilters: ThesisFitResult["failedFilters"] = [];
  const signals: ThesisFitResult["signals"] = [];

  let weightedSignalSum = 0;
  let totalSignalWeight = 0;

  for (const c of active) {
    const isHardFilter = c.category === "HARD_FILTER";

    // ---- RANGE criteria ----
    if (c.dataType === "RANGE" && c.companyField) {
      const val = company[c.companyField] as number | null | undefined;
      if (val === null || val === undefined) {
        signals.push({ id: c.id, name: c.name, category: c.category, result: { status: "UNKNOWN", label: "No data" }, importance: c.importance });
        continue;
      }

      const tooLow = c.minValue !== null && val < c.minValue;
      const tooHigh = c.maxValue !== null && val > c.maxValue;
      const passes = !tooLow && !tooHigh;

      const label = formatRangeLabel(val, c);

      if (isHardFilter && !passes) {
        failedFilters.push({
          id: c.id,
          name: c.name,
          reason: tooLow
            ? `${label} (min: ${c.minValue}${c.unit ? " " + c.unit : ""})`
            : `${label} (max: ${c.maxValue}${c.unit ? " " + c.unit : ""})`,
        });
      } else if (!isHardFilter) {
        const result: CriterionResult = passes
          ? { status: "PASS", label }
          : { status: "FAIL", label };
        signals.push({ id: c.id, name: c.name, category: c.category, result, importance: c.importance });
        weightedSignalSum += passes ? c.importance : 0;
        totalSignalWeight += c.importance;
      } else if (isHardFilter && passes) {
        signals.push({ id: c.id, name: c.name, category: c.category, result: { status: "PASS", label }, importance: c.importance });
      }
    }

    // ---- BOOLEAN criteria ----
    else if (c.dataType === "BOOLEAN" && c.boolField) {
      const val = company[c.boolField] as boolean | null | undefined;
      if (val === null || val === undefined) {
        signals.push({ id: c.id, name: c.name, category: c.category, result: { status: "UNKNOWN", label: "Not assessed" }, importance: c.importance });
        continue;
      }

      const passes = val === c.boolTarget;
      const label = passes ? "Yes" : "No";

      if (isHardFilter && !passes) {
        failedFilters.push({ id: c.id, name: c.name, reason: `Expected ${c.boolTarget ? "Yes" : "No"}, got ${val ? "Yes" : "No"}` });
      } else if (!isHardFilter) {
        const result: CriterionResult = passes ? { status: "PASS", label } : { status: "FAIL", label };
        signals.push({ id: c.id, name: c.name, category: c.category, result, importance: c.importance });
        weightedSignalSum += passes ? c.importance : 0;
        totalSignalWeight += c.importance;
      } else {
        signals.push({ id: c.id, name: c.name, category: c.category, result: { status: "PASS", label: "Yes" }, importance: c.importance });
      }
    }

    // ---- TEXT / qualitative (manual) criteria ----
    else if (c.dataType === "TEXT") {
      // TEXT signals are manually assessed — show as UNKNOWN unless we have a stored assessment
      signals.push({ id: c.id, name: c.name, category: c.category, result: { status: "UNKNOWN", label: "Needs review" }, importance: c.importance });
      // Don't count in weighted score since it's unassessed
    }
  }

  const hardFilterPass = failedFilters.length === 0;
  const score = totalSignalWeight > 0
    ? Math.round((weightedSignalSum / totalSignalWeight) * 100)
    : null;

  return { score, hardFilterPass, failedFilters, signals };
}

function formatRangeLabel(val: number, c: ThesisCriterion): string {
  const u = c.unit ?? "";
  if (u === "year") return `${val}`;
  if (u === "$M") return `$${val}M`;
  if (u === "$K") return `$${val}K`;
  if (u === "employees") return `${val}`;
  if (u === "%") return `${val}%`;
  return `${val}${u ? " " + u : ""}`;
}

export const FEEDBACK_SIGNALS = [
  { value: "HIGH_PRIORITY", label: "High Priority", emoji: "🔥", color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
  { value: "INTERESTED", label: "Interested", emoji: "👍", color: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" },
  { value: "WATCH", label: "Watch", emoji: "👀", color: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200" },
  { value: "PASS", label: "Pass", emoji: "✕", color: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" },
] as const;

export type FeedbackSignal = typeof FEEDBACK_SIGNALS[number]["value"];
