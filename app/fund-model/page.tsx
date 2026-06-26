"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Calculator, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

// ─── Single-Fund Model Types ───────────────────────────────────────────────────

interface Inputs {
  fundSize: number;
  deployYears: number;
  holdYears: number;
  grossMoic: number;
  mgmtFeeRate: number;
  carryRate: number;
  fundLife: number;
  recycleRate: number;
  waterfall: "american" | "european";
}

interface CashflowRow {
  year: number;
  lpCall: number;
  grossExits: number;
  gpCarryDist: number;
  lpNetCashflow: number;
}

interface Outputs {
  feeCommitted: number; feeCommittedYears: number; feeDeployedYears: number;
  totalMgmtFees: number; investedCapital: number; recycledCapital: number; totalDeployed: number;
  grossProceeds: number; grossMoicOnFund: number; grossIrr: number | null;
  fundProfit: number; gpCarry: number; gpTotalEconomics: number;
  lpNetProceeds: number; lpNetMoic: number; lpNetIrr: number | null;
  rows: CashflowRow[];
}

// ─── Single-Fund Finance ───────────────────────────────────────────────────────

function calcIrr(cfs: number[]): number | null {
  if (!cfs.some(c => c < 0) || !cfs.some(c => c > 0)) return null;
  let r = 0.1;
  for (let i = 0; i < 2000; i++) {
    let f = 0, df = 0;
    for (let t = 0; t < cfs.length; t++) {
      const d = Math.pow(1 + r, t);
      f += cfs[t] / d;
      df -= t * cfs[t] / (d * (1 + r));
    }
    if (Math.abs(df) < 1e-12) return null;
    const r2 = r - f / df;
    if (!isFinite(r2) || isNaN(r2)) return null;
    if (Math.abs(r2 - r) < 1e-8) return r2;
    r = r2;
  }
  return null;
}

function runModel(inp: Inputs): Outputs {
  const { fundSize, deployYears, holdYears, grossMoic, mgmtFeeRate, carryRate, fundLife, recycleRate, waterfall } = inp;
  const r = mgmtFeeRate / 100;

  // Fee periods
  const feeCommittedYears = Math.min(5, Math.ceil(deployYears));
  const feeDeployedYears  = fundLife - feeCommittedYears;

  // Post-deployment fee multiplier: sum of (remaining cohort fraction) over each post-deployment year.
  // Cohort c exits at end of yr (c+holdYears); that slice leaves the fee basis from start of yr (c+holdYears+1).
  let postFeeMultiplier = 0;
  for (let yr = feeCommittedYears + 1; yr <= fundLife; yr++) {
    const exitedCohorts = Math.max(0, Math.min(deployYears, yr - holdYears - 1));
    const remaining = deployYears - exitedCohorts;
    if (remaining <= 0) break;
    postFeeMultiplier += remaining / deployYears;
  }

  // Solve: fundSize = investedCapital + committedFees + r*investedCapital*postFeeMultiplier
  // => investedCapital = fundSize*(1 - feeCommittedYears*r) / (1 + r*postFeeMultiplier)
  const feeCommitted    = fundSize * r;
  const investedCapital = fundSize * (1 - feeCommittedYears * r) / (1 + r * postFeeMultiplier);

  const recycledCapital = investedCapital * (recycleRate / 100);
  const totalDeployed   = investedCapital + recycledCapital;

  const grossProceeds = totalDeployed * grossMoic;
  const lpCapital  = fundSize;
  const fundProfit = grossProceeds - lpCapital;
  const gpCarry    = fundProfit * (carryRate / 100);
  const totalMgmtFees = feeCommitted * feeCommittedYears + r * investedCapital * postFeeMultiplier;
  const gpTotalEconomics = gpCarry + totalMgmtFees;
  const lpNetProceeds = grossProceeds - gpCarry;
  const lpNetMoic = lpNetProceeds / fundSize;

  // Cash flows
  const rows: CashflowRow[] = [];
  const callPerYear = -lpCapital / deployYears;
  let cohortCostBasis = investedCapital / deployYears;
  let lpIrrCfs: number[] = Array(fundLife + 1).fill(0);

  for (let yr = 1; yr <= fundLife; yr++) {
    const lpCall = yr <= deployYears ? callPerYear : 0;
    lpIrrCfs[yr] += lpCall;
    lpIrrCfs[0]  += 0;
  }

  let gpCarryDist = 0, lpNetCashflow = 0, grossExits = 0;

  for (let yr = 1; yr <= fundLife; yr++) {
    grossExits = 0; gpCarryDist = 0; lpNetCashflow = 0;
    const lpCall = yr <= deployYears ? callPerYear : 0;

    for (let cohort = 1; cohort <= deployYears; cohort++) {
      const exitYear = cohort + holdYears;
      if (exitYear !== yr) continue;
      const grossExit = cohortCostBasis * grossMoic;
      grossExits += grossExit;
      const profit = grossExit - cohortCostBasis;

      if (waterfall === "american") {
        gpCarryDist  = profit * (carryRate / 100);
        lpNetCashflow += cohortCostBasis + profit * (1 - carryRate / 100);
      } else {
        const totalCapReturned = rows.reduce((a, r) => a + Math.max(0, r.lpNetCashflow), 0);
        const capReturn = Math.max(0, Math.min(grossExit, lpCapital - totalCapReturned));
        if (totalCapReturned + capReturn >= lpCapital) {
          gpCarryDist     = profit * (carryRate / 100);
          lpNetCashflow  += capReturn + profit * (1 - carryRate / 100);
        } else {
          gpCarryDist = grossExit * (carryRate / 100);
          lpNetCashflow   = grossExit * (1 - carryRate / 100);
        }
      }
    }
    lpNetCashflow += lpCall;
    lpIrrCfs[yr] = lpNetCashflow;
    rows.push({ year: yr, lpCall, grossExits, gpCarryDist, lpNetCashflow });
  }

  const grossIrr = calcIrr([-investedCapital, ...Array(holdYears - 1).fill(0), grossProceeds]);
  const lpNetIrr = calcIrr(lpIrrCfs);

  return {
    feeCommitted, feeCommittedYears, feeDeployedYears,
    totalMgmtFees, investedCapital, recycledCapital, totalDeployed,
    grossProceeds, grossMoicOnFund: grossProceeds / fundSize,
    grossIrr, fundProfit, gpCarry, gpTotalEconomics,
    lpNetProceeds, lpNetMoic, lpNetIrr,
    rows: rows.filter(r => Math.abs(r.lpCall) > 0.001 || r.grossExits > 0.001),
  };
}

// ─── UI helpers (single-fund) ─────────────────────────────────────────────────

const fm  = (v: number) => `$${v.toFixed(1)}M`;
const mx  = (v: number) => `${v.toFixed(2)}×`;
const pct = (v: number | null) => v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: "blue" | "emerald" | "amber" }) {
  const cls = {
    blue:    "bg-blue-50   border-blue-100   text-blue-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber:   "bg-amber-50  border-amber-100  text-amber-700",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, sub }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string; sub?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-sm font-bold text-slate-900">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Annual GP P&L — types & compute ─────────────────────────────────────────

interface APLInputs {
  // Fund structure
  f1SizeM: number; f2SizeM: number; f3SizeM: number;
  launchYear: number;        // Year 1 calendar year
  deployYrs: number;         // years per fund (assume equal)
  mgmtFeeRate: number;       // % e.g. 2.0
  dawRate: number;           // carry % e.g. 20
  mbGpCommitPct: number;     // MB GP commit % e.g. 1.0
  teamGpCommitPct: number;   // Team GP commit % (lower) e.g. 0.5
  feeWaiverPct: number;      // % of GP commit funded via waived fees e.g. 80
  compGrowth: number;        // % annual raise — used to seed the editable comp grid
  // Expense rates
  benefitsRate: number;      // % of comp (default 10)
  empTaxRate: number;        // % of comp (default 8)
  overheadRate: number;      // % of comp (default 20)
  // DAW allocations ($K per fund)
  mbDaw_f1: number; mbDaw_f2: number; mbDaw_f3: number;
  mbDawOther_f1: number; mbDawOther_f2: number; mbDawOther_f3: number;
  upfrontDaw: number;
  teamDaw_f1: number; teamDaw_f2: number; teamDaw_f3: number;
}

const APL_DEF: APLInputs = {
  f1SizeM: 100, f2SizeM: 150, f3SizeM: 225,
  launchYear: 2027, deployYrs: 3,
  mgmtFeeRate: 2.0, dawRate: 20,
  mbGpCommitPct: 1.0, teamGpCommitPct: 0.5, feeWaiverPct: 80,
  compGrowth: 3,
  benefitsRate: 10, empTaxRate: 8, overheadRate: 20,
  mbDaw_f1: 7000, mbDaw_f2: 9000, mbDaw_f3: 11000,
  mbDawOther_f1: 2000, mbDawOther_f2: 3000, mbDawOther_f3: 4000,
  upfrontDaw: 2000,
  teamDaw_f1: 850, teamDaw_f2: 3000, teamDaw_f3: 5000,
};

// ── Team roster — seniority order, high → low. Each role holds a 9-year editable
//    salary array ($K). `seedBase`/`startYr` drive the formula-seed; `seedArr`
//    (MB) provides explicit per-fund values that step at each raise.
interface RoleDef {
  id: string; label: string; sublabel: string;
  startYr: number; seedBase?: number; seedArr?: number[];
}
const COMP_ROLES: RoleDef[] = [
  { id: "mb",        label: "MB / Managing Partner", sublabel: "Founder",      startYr: 1, seedArr: [700, 700, 700, 850, 850, 850, 1000, 1000, 1000] },
  { id: "partner",   label: "Partner",              sublabel: "Yr 5+",        startYr: 5, seedBase: 500 },
  { id: "principal", label: "Principal",            sublabel: "Yr 4+",        startYr: 4, seedBase: 550 },
  { id: "vp",        label: "VP",                   sublabel: "",             startYr: 1, seedBase: 400 },
  { id: "associate", label: "Associate",           sublabel: "",             startYr: 1, seedBase: 165 },
  { id: "analyst",   label: "Analyst",             sublabel: "Yr 4+",        startYr: 4, seedBase: 130 },
];
const COMP_ROLE_IDS = COMP_ROLES.map(r => r.id);

type CompGrid = Record<string, number[]>;

function seedComp(growth: number): CompGrid {
  const g = growth / 100;
  const grid: CompGrid = {};
  for (const r of COMP_ROLES) {
    if (r.seedArr) {
      grid[r.id] = [...r.seedArr];
    } else {
      grid[r.id] = Array.from({ length: 9 }, (_, i) => {
        const yr = i + 1;
        return yr < r.startYr ? 0 : Math.round((r.seedBase ?? 0) * Math.pow(1 + g, yr - r.startYr));
      });
    }
  }
  return grid;
}

interface YrData {
  yr: number; calYear: number; activeFund: number;
  feeF1: number; feeF2: number; feeF3: number;
  grossFees: number;
  mbWaiver: number; teamWaiver: number; feeWaiver: number;
  netFees: number;
  totalComp: number;
  benefits: number; empTaxes: number; overhead: number;
  totalExpenses: number; houseNetPL: number;
}

function computeAPL(d: APLInputs, comp: CompGrid): YrData[] {
  const D = d.deployYrs;
  const STEP = [1.0, 0.75, 0.50, 0.25, 0.0];
  const fullFee = (sizeM: number) => Math.round(sizeM * 1000 * (d.mgmtFeeRate / 100));
  const f1F = fullFee(d.f1SizeM), f2F = fullFee(d.f2SizeM), f3F = fullFee(d.f3SizeM);

  // Annual GP-commit fee waiver per fund's deployment — split MB vs. team
  const waiverAnn = (sizeM: number, commitPct: number) =>
    Math.round(sizeM * 1000 * (commitPct / 100) * (d.feeWaiverPct / 100) / D);
  const mbW1 = waiverAnn(d.f1SizeM, d.mbGpCommitPct), mbW2 = waiverAnn(d.f2SizeM, d.mbGpCommitPct), mbW3 = waiverAnn(d.f3SizeM, d.mbGpCommitPct);
  const tmW1 = waiverAnn(d.f1SizeM, d.teamGpCommitPct), tmW2 = waiverAnn(d.f2SizeM, d.teamGpCommitPct), tmW3 = waiverAnn(d.f3SizeM, d.teamGpCommitPct);

  const step = (full: number, offset: number) => Math.round(full * STEP[Math.min(offset, 4)]);

  return Array.from({ length: 9 }, (_, i) => {
    const yr = i + 1;
    const calYear = d.launchYear + i;
    const activeFund = yr <= D ? 1 : yr <= D * 2 ? 2 : 3;

    // Fee revenue — step down after each fund's deployment period
    const feeF1 = yr <= D ? f1F : step(f1F, yr - D - 1);
    const feeF2 = yr < D + 1 ? 0 : yr <= D * 2 ? f2F : step(f2F, yr - D * 2 - 1);
    const feeF3 = yr < D * 2 + 1 ? 0 : f3F; // fund 3 still deploying in yrs 7-9
    const grossFees = feeF1 + feeF2 + feeF3;

    // GP-commit fee waivers (non-cash) during each fund's deployment
    const mbWaiver   = yr <= D ? mbW1 : yr <= D * 2 ? mbW2 : mbW3;
    const teamWaiver = yr <= D ? tmW1 : yr <= D * 2 ? tmW2 : tmW3;
    const feeWaiver  = mbWaiver + teamWaiver;
    const netFees = grossFees - feeWaiver;

    // Compensation — read straight off the editable grid
    const totalComp = COMP_ROLE_IDS.reduce((s, id) => s + (comp[id]?.[i] ?? 0), 0);

    const benefits  = Math.round(totalComp * (d.benefitsRate / 100));
    const empTaxes  = Math.round(totalComp * (d.empTaxRate / 100));
    const overhead  = Math.round(totalComp * (d.overheadRate / 100));
    const totalExpenses = totalComp + benefits + empTaxes + overhead;
    const houseNetPL = netFees - totalExpenses;

    return {
      yr, calYear, activeFund,
      feeF1, feeF2, feeF3, grossFees,
      mbWaiver, teamWaiver, feeWaiver, netFees,
      totalComp, benefits, empTaxes, overhead,
      totalExpenses, houseNetPL,
    };
  });
}

// ─── Annual GP P&L — helper render utils ──────────────────────────────────────

const fk  = (v: number) => Math.abs(v) < 0.5 ? "—" : v < 0
  ? `(${Math.abs(Math.round(v)).toLocaleString()})`
  : `${Math.round(v).toLocaleString()}`;
const fp  = (v: number) => `${v.toFixed(1)}%`;

function InlineInput({ value, onChange, width = "w-20" }: {
  value: number; onChange: (v: number) => void; width?: string;
}) {
  return (
    <input type="number" value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      className={`${width} text-right tabular-nums text-xs bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white`}
    />
  );
}

// ─── Annual GP P&L — component ────────────────────────────────────────────────

function GPPnL() {
  const [d, setD] = useState<APLInputs>(APL_DEF);
  const upd = <K extends keyof APLInputs>(k: K, v: APLInputs[K]) => setD(p => ({ ...p, [k]: v }));
  const [comp, setComp] = useState<CompGrid>(() => seedComp(APL_DEF.compGrowth));
  const editComp = (roleId: string, i: number, v: number) =>
    setComp(p => ({ ...p, [roleId]: (p[roleId] ?? Array(9).fill(0)).map((x, j) => (j === i ? v : x)) }));
  const resetComp = () => setComp(seedComp(d.compGrowth));
  const [showFund, setShowFund] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showDaw,  setShowDaw]  = useState(false);

  const yrs = useMemo(() => computeAPL(d, comp), [d, comp]);
  const sum  = (get: (y: YrData) => number) => yrs.reduce((s, y) => s + get(y), 0);

  // DAW pools
  const dawPool = (sizeM: number) => Math.round(sizeM * 1000 * (d.dawRate / 100));
  const dp1 = dawPool(d.f1SizeM), dp2 = dawPool(d.f2SizeM), dp3 = dawPool(d.f3SizeM);
  const mbDawTotal = (d.upfrontDaw + d.mbDaw_f1 + d.mbDawOther_f1) +
                     (d.mbDaw_f2 + d.mbDawOther_f2) + (d.mbDaw_f3 + d.mbDawOther_f3);
  const teamDawTotal = d.teamDaw_f1 + d.teamDaw_f2 + d.teamDaw_f3;
  const houseRemaining = (dp1 - d.mbDaw_f1 - d.teamDaw_f1) +
                         (dp2 - d.mbDaw_f2 - d.teamDaw_f2) +
                         (dp3 - d.mbDaw_f3 - d.teamDaw_f3);

  // Fund grouping info
  const fundGroups = [
    { label: "Fund 1", years: yrs.slice(0, 3), color: "blue",   bg: "bg-blue-600",   th: "bg-blue-50"   },
    { label: "Fund 2", years: yrs.slice(3, 6), color: "indigo", bg: "bg-indigo-600", th: "bg-indigo-50" },
    { label: "Fund 3", years: yrs.slice(6, 9), color: "violet", bg: "bg-violet-600", th: "bg-violet-50" },
  ];

  type RowSpec = {
    id: string;
    label: string;
    sublabel?: string;
    get: (y: YrData) => number;
    style: "section" | "revenue" | "deduct" | "subtotal-rev" | "comp" | "expense" | "subtotal-hce" | "bottom";
    note?: string;
    onlyWhen?: (y: YrData) => boolean;
    editId?: string;   // when set, year cells are directly editable (bound to comp grid)
  };

  const compRows: RowSpec[] = COMP_ROLES.map(r => ({
    id: r.id,
    label: r.label,
    sublabel: r.sublabel || undefined,
    get: (y: YrData) => comp[r.id]?.[y.yr - 1] ?? 0,
    style: "comp" as const,
    editId: r.id,
  }));

  const rows: RowSpec[] = [
    // ── Revenue ──────────────────────────────────────────────────────────────
    { id: "s-rev",    label: "REVENUE",                                     get: () => 0,              style: "section" },
    { id: "feeF1",    label: "Mgmt Fees — Fund 1",                          get: y => y.feeF1,         style: "revenue",      note: `Full ${fp(d.mgmtFeeRate)} → steps to 75/50/25% post-deploy` },
    { id: "feeF2",    label: "Mgmt Fees — Fund 2",                          get: y => y.feeF2,         style: "revenue",      onlyWhen: y => y.yr > d.deployYrs },
    { id: "feeF3",    label: "Mgmt Fees — Fund 3",                          get: y => y.feeF3,         style: "revenue",      onlyWhen: y => y.yr > d.deployYrs * 2 },
    { id: "grossFees",label: "Total Gross Mgmt Fees",                       get: y => y.grossFees,     style: "subtotal-rev", note: "Sum of all active fund fees" },
    { id: "mbWaiver",   label: "MB GP Commit Fee Waiver",                   get: y => -y.mbWaiver,     style: "deduct",       note: `${fp(d.mbGpCommitPct)} commit · ${fp(d.feeWaiverPct)} waived ÷ ${d.deployYrs} yrs · non-cash` },
    { id: "teamWaiver", label: "Team GP Commit Fee Waiver",                 get: y => -y.teamWaiver,   style: "deduct",       note: `${fp(d.teamGpCommitPct)} commit · ${fp(d.feeWaiverPct)} waived ÷ ${d.deployYrs} yrs · non-cash` },
    { id: "netFees",  label: "Net Cash Mgmt Fees",                          get: y => y.netFees,       style: "subtotal-rev", note: "Cash revenue available for operations" },

    // ── Headcount Compensation (editable — click any cell) ─────────────────────
    { id: "s-comp",   label: "HEADCOUNT COMPENSATION",                      get: () => 0,              style: "section" },
    ...compRows,
    { id: "totComp",  label: "Total HC Salary / Cash Comp",                  get: y => y.totalComp,     style: "subtotal-rev", note: "Cash comp only · carry/DAW allocated separately" },

    // ── Expenses (benefits, taxes, G&A) ───────────────────────────────────────
    { id: "benefits", label: "Benefits",           sublabel: `${d.benefitsRate}% of comp`,  get: y => y.benefits,  style: "expense", note: "Health, dental, 401k match, etc." },
    { id: "empTax",   label: "Employer Taxes",     sublabel: `${d.empTaxRate}% of comp`,    get: y => y.empTaxes,  style: "expense", note: "FICA, FUTA, SUI" },
    { id: "oh",       label: "General & Administrative", sublabel: `${d.overheadRate}% of comp`, get: y => y.overhead, style: "expense", note: "Rent, tech, travel, legal, fund admin" },
    { id: "totExp",   label: "Total Expenses",                               get: y => y.totalExpenses, style: "subtotal-hce" },

    // ── Bottom line ───────────────────────────────────────────────────────────
    { id: "house",    label: "MGMT FEE TO THE HOUSE",                       get: y => y.houseNetPL,    style: "bottom",       note: "Net cash fees less total expenses" },
  ];

  const colStyle = (y: YrData) =>
    y.activeFund === 1 ? "bg-blue-50/30" : y.activeFund === 2 ? "bg-indigo-50/30" : "bg-violet-50/30";

  const renderCell = (row: RowSpec, y: YrData) => {
    // Editable comp cell — spreadsheet-style direct entry
    if (row.editId) {
      const cur = comp[row.editId]?.[y.yr - 1] ?? 0;
      return (
        <td key={y.yr} className={`px-1 py-0.5 text-right ${colStyle(y)}`}>
          <input
            type="number"
            value={cur === 0 ? "" : cur}
            placeholder="—"
            onChange={e => editComp(row.editId!, y.yr - 1, Number(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            className="w-[58px] text-right tabular-nums text-xs text-slate-700 bg-transparent rounded px-1 py-1 border border-transparent hover:border-blue-200 hover:bg-blue-50/60 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-slate-300"
          />
        </td>
      );
    }
    const v = row.get(y);
    const hide = row.onlyWhen && !row.onlyWhen(y);
    if (hide || Math.abs(v) < 0.5) {
      return <td key={y.yr} className={`px-3 py-1.5 text-right tabular-nums text-[11px] text-slate-300 ${colStyle(y)}`}>—</td>;
    }
    const isNeg = v < 0;
    const textCls =
      row.style === "deduct"       ? "text-rose-500 italic" :
      row.style === "bottom"       ? (v >= 0 ? "text-emerald-700 font-black text-sm" : "text-red-600 font-black text-sm") :
      row.style === "subtotal-rev" ? "font-bold text-slate-800" :
      row.style === "subtotal-hce" ? "font-bold text-amber-800" :
      "text-slate-700";
    return (
      <td key={y.yr} className={`px-3 py-1.5 text-right tabular-nums text-xs ${textCls} ${colStyle(y)}`}>
        {isNeg ? <span className="text-rose-500">{fk(v)}</span> : fk(v)}
      </td>
    );
  };

  const renderTotal = (row: RowSpec) => {
    if (row.style === "section" || row.style === "expense") return <td className="px-3 py-1.5 text-right text-[11px] text-slate-300 bg-slate-50">—</td>;
    const v = sum(row.get);
    if (Math.abs(v) < 0.5) return <td className="px-3 py-1.5 text-right text-[11px] text-slate-300 bg-slate-50">—</td>;
    const isNeg = v < 0;
    const textCls =
      row.style === "deduct"       ? "text-rose-500 italic text-xs" :
      row.style === "bottom"       ? (v >= 0 ? "text-emerald-700 font-black text-sm" : "text-red-600 font-black text-sm") :
      row.style === "subtotal-rev" ? "font-bold text-slate-800 text-xs" :
      row.style === "subtotal-hce" ? "font-bold text-amber-800 text-xs" :
      "text-slate-600 text-xs";
    return (
      <td className={`px-3 py-1.5 text-right tabular-nums bg-slate-50 ${textCls}`}>
        {isNeg ? <span className="text-rose-500">{fk(v)}</span> : fk(v)}
      </td>
    );
  };

  const ParamSection = ({ title, open, onToggle, children }: {
    title: string; open: boolean; onToggle: () => void; children: ReactNode;
  }) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
    </div>
  );

  const totalHousePL = sum(y => y.houseNetPL);
  const peakHousePL  = Math.max(...yrs.map(y => y.houseNetPL));
  const yr1HousePL   = yrs[0]?.houseNetPL ?? 0;
  const yr4HousePL   = yrs[3]?.houseNetPL ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Yr 1 House P&L", value: yr1HousePL,    sub: "First year operations" },
          { label: "Fund 2 Launch",  value: yr4HousePL,    sub: "Year 4 — step-change" },
          { label: "Peak House P&L", value: peakHousePL,   sub: "Best single year" },
          { label: "9-Yr Cumulative",value: totalHousePL,  sub: "House operating P&L" },
        ].map((m, i) => (
          <div key={i} className={`rounded-xl border p-3 ${m.value >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{m.label}</p>
            <p className={`text-xl font-black tabular-nums ${m.value >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {m.value >= 0 ? "" : "("}{fk(Math.abs(m.value))}{m.value < 0 ? ")" : ""}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Expense rate toggles — always visible */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-3">Expense Rate Assumptions — adjust to see impact</p>
        <div className="grid grid-cols-3 gap-6">
          <Slider label={`Benefits (${d.benefitsRate}%)`} value={d.benefitsRate} min={5} max={20} step={1}
            onChange={v => upd("benefitsRate", v)} display={fp(d.benefitsRate)}
            sub="Health, dental, 401k match" />
          <Slider label={`Employer Taxes (${d.empTaxRate}%)`} value={d.empTaxRate} min={3} max={15} step={1}
            onChange={v => upd("empTaxRate", v)} display={fp(d.empTaxRate)}
            sub="FICA, FUTA, SUI on comp" />
          <Slider label={`Overhead (${d.overheadRate}%)`} value={d.overheadRate} min={10} max={40} step={2}
            onChange={v => upd("overheadRate", v)} display={fp(d.overheadRate)}
            sub="G&A as % of compensation" />
        </div>
      </div>

      {/* Collapsible param panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Fund & Fees */}
        <ParamSection title="Fund & Fees" open={showFund} onToggle={() => setShowFund(v => !v)}>
          <div className="space-y-3 mt-2">
            {[
              { label: "Fund 1 Size ($M)", k: "f1SizeM" as const },
              { label: "Fund 2 Size ($M)", k: "f2SizeM" as const },
              { label: "Fund 3 Size ($M)", k: "f3SizeM" as const },
            ].map(r => (
              <div key={r.k} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">{r.label}</span>
                <InlineInput value={d[r.k]} onChange={v => upd(r.k, v)} />
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <Slider label="Mgmt Fee" value={d.mgmtFeeRate} min={1} max={3} step={0.25}
                onChange={v => upd("mgmtFeeRate", v)} display={fp(d.mgmtFeeRate)} />
              <Slider label="MB GP Commit %" value={d.mbGpCommitPct} min={0.5} max={5} step={0.25}
                onChange={v => upd("mbGpCommitPct", v)} display={fp(d.mbGpCommitPct)} />
              <Slider label="Team GP Commit %" value={d.teamGpCommitPct} min={0} max={3} step={0.25}
                onChange={v => upd("teamGpCommitPct", v)} display={fp(d.teamGpCommitPct)}
                sub="Lower than MB — funds smaller team commit" />
              <Slider label="Fee Waiver %" value={d.feeWaiverPct} min={50} max={100} step={5}
                onChange={v => upd("feeWaiverPct", v)} display={fp(d.feeWaiverPct)}
                sub="Applies to both MB and team commit" />
            </div>
          </div>
        </ParamSection>

        {/* Team Compensation */}
        <ParamSection title="Team Compensation ($K)" open={showTeam} onToggle={() => setShowTeam(v => !v)}>
          <div className="space-y-3 mt-2 text-xs">
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-[11px] text-blue-700 font-medium">✎ Edit any salary directly in the income statement table below.</p>
              <p className="text-[10px] text-blue-500 mt-0.5">Click a comp cell and type — like a spreadsheet.</p>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold pt-1">Roster (seniority order)</p>
            <ul className="space-y-1 text-slate-600">
              {COMP_ROLES.map(r => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{r.label}</span>
                  <span className="text-[10px] text-slate-400">{r.sublabel || "Yr 1+"}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Slider label="Annual Raise (seed)" value={d.compGrowth} min={0} max={8} step={0.5}
                onChange={v => upd("compGrowth", v)} display={fp(d.compGrowth)}
                sub="Used to re-seed the grid below" />
              <button
                onClick={resetComp}
                className="w-full text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors"
              >
                Reset comp grid to formula
              </button>
            </div>
          </div>
        </ParamSection>

        {/* DAW Allocations */}
        <ParamSection title="DAW / Carry Allocations ($K)" open={showDaw} onToggle={() => setShowDaw(v => !v)}>
          <div className="space-y-2 mt-2 text-xs">
            <Slider label="Carry Rate" value={d.dawRate} min={15} max={30} step={2.5}
              onChange={v => upd("dawRate", v)} display={fp(d.dawRate)} />
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold pt-2">MB DAW (Early Stage Fund)</p>
            {[
              { label: "Fund 1", k: "mbDaw_f1" as const },
              { label: "Fund 2", k: "mbDaw_f2" as const },
              { label: "Fund 3", k: "mbDaw_f3" as const },
            ].map(r => (
              <div key={r.k} className="flex items-center justify-between">
                <span className="text-slate-600">{r.label}</span>
                <InlineInput value={d[r.k]} onChange={v => upd(r.k, v)} />
              </div>
            ))}
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold pt-2">MB DAW (Other Funds)</p>
            {[
              { label: "Fund 1", k: "mbDawOther_f1" as const },
              { label: "Fund 2", k: "mbDawOther_f2" as const },
              { label: "Fund 3", k: "mbDawOther_f3" as const },
            ].map(r => (
              <div key={r.k} className="flex items-center justify-between">
                <span className="text-slate-600">{r.label}</span>
                <InlineInput value={d[r.k]} onChange={v => upd(r.k, v)} />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-600">1× Upfront DAW (F1)</span>
              <InlineInput value={d.upfrontDaw} onChange={v => upd("upfrontDaw", v)} />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold pt-2">Team DAW (Non-MB)</p>
            {[
              { label: "Fund 1", k: "teamDaw_f1" as const },
              { label: "Fund 2", k: "teamDaw_f2" as const },
              { label: "Fund 3", k: "teamDaw_f3" as const },
            ].map(r => (
              <div key={r.k} className="flex items-center justify-between">
                <span className="text-slate-600">{r.label}</span>
                <InlineInput value={d[r.k]} onChange={v => upd(r.k, v)} />
              </div>
            ))}
          </div>
        </ParamSection>
      </div>

      {/* Main Income Statement */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Management Company Income Statement</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All figures in $K · Annual</p>
          </div>
        </div>
        <table className="w-full text-xs border-collapse" style={{ minWidth: "860px" }}>
          <thead>
            {/* Fund group header */}
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left w-44" />
              {fundGroups.map(fg => (
                <th key={fg.label} colSpan={3}
                  className={`px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white ${fg.bg}`}>
                  {fg.label}
                </th>
              ))}
              <th className="px-3 py-1.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 w-20">
                9-Yr Total
              </th>
            </tr>
            {/* Year header */}
            <tr className="border-b-2 border-slate-200">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Line Item
              </th>
              {yrs.map(y => (
                <th key={y.yr}
                  className={`px-3 py-2 text-center text-[10px] font-semibold text-slate-600 ${
                    y.activeFund === 1 ? "bg-blue-50" : y.activeFund === 2 ? "bg-indigo-50" : "bg-violet-50"
                  }`}>
                  Yr {y.yr}<br />
                  <span className="font-normal text-slate-400">{y.calYear}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-400 bg-slate-50" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              if (row.style === "section") {
                return (
                  <tr key={row.id} className="bg-slate-100">
                    <td colSpan={11} className="sticky left-0 z-10 bg-slate-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {row.label}
                    </td>
                  </tr>
                );
              }
              const isSubtotal = row.style === "subtotal-rev" || row.style === "subtotal-hce";
              const isBottom   = row.style === "bottom";
              const rowBg      = isBottom ? "" : isSubtotal ? "bg-slate-50" : "";
              const labelCls   =
                isBottom   ? "sticky left-0 z-10 bg-white px-4 py-2.5 font-black text-slate-900 uppercase tracking-wide text-[11px] border-t-2 border-slate-800" :
                isSubtotal ? "sticky left-0 z-10 bg-slate-50 px-4 py-2 font-bold text-slate-800 border-t border-slate-200" :
                row.style === "expense" ? "sticky left-0 z-10 bg-white px-4 py-1.5 text-slate-500 pl-8" :
                "sticky left-0 z-10 bg-white px-4 py-1.5 text-slate-700";
              return (
                <tr key={row.id} className={`border-t border-slate-100 ${rowBg} ${isBottom ? "border-t-2 border-slate-800" : ""}`}>
                  <td className={labelCls}>
                    <span>{row.label}</span>
                    {row.sublabel && <span className="text-[10px] text-slate-400 ml-1.5 font-normal">{row.sublabel}</span>}
                    {row.note && !isBottom && <p className="text-[10px] text-slate-400 font-normal normal-case tracking-normal mt-0.5">{row.note}</p>}
                  </td>
                  {yrs.map(y => renderCell(row, y))}
                  {renderTotal(row)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DAW / Carry Economics */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Carried Interest Economics (Total Potential · $K)</p>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Allocation", "Fund 1", "Fund 2", "Fund 3", "Total"].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide ${h === "Allocation" ? "text-left text-slate-400" : "text-right text-slate-500"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: "Total DAW Pool",         f1: dp1,               f2: dp2,               f3: dp3,               style: "bold" },
                { label: "MB — Early Stage Fund",  f1: d.mbDaw_f1,        f2: d.mbDaw_f2,        f3: d.mbDaw_f3,        style: "" },
                { label: "MB — Other Funds",       f1: d.mbDawOther_f1,   f2: d.mbDawOther_f2,   f3: d.mbDawOther_f3,   style: "" },
                { label: "1× Upfront DAW",         f1: d.upfrontDaw,      f2: 0,                 f3: 0,                 style: "" },
                { label: "MB DAW Total",            f1: d.upfrontDaw + d.mbDaw_f1 + d.mbDawOther_f1, f2: d.mbDaw_f2 + d.mbDawOther_f2, f3: d.mbDaw_f3 + d.mbDawOther_f3, style: "bold amber" },
                { label: "Team DAW (Non-MB)",       f1: d.teamDaw_f1,     f2: d.teamDaw_f2,      f3: d.teamDaw_f3,      style: "" },
                { label: "House — Remaining DAW",   f1: dp1 - d.mbDaw_f1 - d.teamDaw_f1, f2: dp2 - d.mbDaw_f2 - d.teamDaw_f2, f3: dp3 - d.mbDaw_f3 - d.teamDaw_f3, style: "bold emerald" },
              ].map((r, i) => {
                const total = r.f1 + r.f2 + r.f3;
                const isBold = r.style.includes("bold");
                const cls = r.style.includes("emerald") ? "text-emerald-700" : r.style.includes("amber") ? "text-amber-700" : "text-slate-700";
                return (
                  <tr key={i} className={isBold ? "bg-slate-50" : ""}>
                    <td className={`px-4 py-2 ${isBold ? "font-bold " + cls : "text-slate-600"}`}>{r.label}</td>
                    {[r.f1, r.f2, r.f3, total].map((v, j) => (
                      <td key={j} className={`px-4 py-2 text-right tabular-nums ${isBold ? "font-bold " + cls : "text-slate-700"}`}>
                        {v > 0 ? fk(v) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td className="px-4 py-2 text-xs font-bold text-slate-700">House Share of Total DAW</td>
                {[dp1, dp2, dp3, dp1 + dp2 + dp3].map((pool, i) => {
                  const remaining = i < 3
                    ? [dp1 - d.mbDaw_f1 - d.teamDaw_f1, dp2 - d.mbDaw_f2 - d.teamDaw_f2, dp3 - d.mbDaw_f3 - d.teamDaw_f3][i]
                    : houseRemaining;
                  const pct = pool > 0 ? (remaining / pool * 100).toFixed(0) : "—";
                  return <td key={i} className="px-4 py-2 text-right tabular-nums font-bold text-emerald-700">{pct}%</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        All figures in $K. Compensation cells are directly editable — click any salary in the table to override it.
        Fee step-down: 75% / 50% / 25% of committed-period rate in years 1–3 after each fund's deployment ends.
        Partner joins Yr 5; Principal &amp; Analyst join Yr 4 — earlier years are blank.
        Total Expenses = Total HC Salary/Cash Comp + Benefits + Employer Taxes + G&amp;A. Mgmt Fee to the House = Net Cash Mgmt Fees − Total Expenses.
        Both MB and team fund their GP commits via waived fees ({fp(d.feeWaiverPct)}). DAW figures are total potential carry, not present value.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULTS: Inputs = {
  fundSize: 100, deployYears: 3, holdYears: 5, grossMoic: 3.0,
  mgmtFeeRate: 2.0, carryRate: 20, fundLife: 10, recycleRate: 0, waterfall: "american",
};

export default function FundModelPage() {
  const [tab, setTab] = useState<"returns" | "pnl">("returns");
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const set = (k: keyof Inputs) => (v: number) => setInp(p => ({ ...p, [k]: v }));

  const out = useMemo(() => runModel(inp), [inp]);

  const scenarios = useMemo(() => [
    { label: "Bear",  moic: 2.0 },
    { label: "Base",  moic: inp.grossMoic },
    { label: "Bull",  moic: 4.0 },
  ].map(s => ({ ...s, o: runModel({ ...inp, grossMoic: s.moic }) })), [inp]);

  const SCENARIO_ROWS: { label: string; fmt: (o: Outputs, moic: number) => string }[] = [
    { label: "Gross MOIC (invested)",  fmt: (_, m) => mx(m) },
    { label: "Gross MOIC (fund)",      fmt: o => mx(o.grossMoicOnFund) },
    { label: "Gross IRR",              fmt: o => pct(o.grossIrr) },
    { label: "LP Net MOIC",            fmt: o => mx(o.lpNetMoic) },
    { label: "LP Net IRR",             fmt: o => pct(o.lpNetIrr) },
    { label: "LP Net Proceeds",        fmt: o => fm(o.lpNetProceeds) },
    { label: "GP Carry",               fmt: o => fm(o.gpCarry) },
    { label: "GP Total Economics",     fmt: o => fm(o.gpTotalEconomics) },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Calculator className="text-blue-500" size={20} />
          <h1 className="text-xl font-bold text-slate-900">GP Fund Model</h1>
        </div>
        <p className="text-sm text-slate-500">Fund returns calculator and multi-fund management company P&amp;L.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { key: "returns", label: "Fund Returns" },
          { key: "pnl",     label: "GP P&L" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Fund Returns Tab ─────────────────────────────────────────────────── */}
      {tab === "returns" && (
        <div className="space-y-6 sm:space-y-8">
          <p className="text-sm text-slate-500 -mt-3">Adjust any parameter — returns update instantly. Total GP carry is identical between waterfall styles; only timing differs.</p>

          {/* Inputs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-5">Parameters</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 sm:gap-x-8 gap-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Fund Size</span>
                  <span className="text-sm font-bold text-slate-900">${inp.fundSize}M</span>
                </div>
                <input type="range" min={10} max={500} step={5} value={inp.fundSize}
                  onChange={e => set("fundSize")(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Investable: <strong className="text-slate-600">${out.investedCapital.toFixed(1)}M</strong></span>
                  <span>Fees: <strong className="text-slate-600">${out.totalMgmtFees.toFixed(1)}M</strong></span>
                </div>
              </div>

              <Slider label="Deployment Period" value={inp.deployYears} min={1} max={6} step={1}
                onChange={set("deployYears")} display={`${inp.deployYears} yrs`} />
              <Slider label="Avg Hold Period" value={inp.holdYears} min={2} max={8} step={1}
                onChange={set("holdYears")} display={`${inp.holdYears} yrs`} />
              <Slider label="Gross MOIC (per Investment)" value={inp.grossMoic} min={1.0} max={6.0} step={0.1}
                onChange={set("grossMoic")} display={mx(inp.grossMoic)}
                sub="target MOIC at the individual portfolio company level, not fund level" />
              <Slider label="Management Fee" value={inp.mgmtFeeRate} min={0.5} max={3.0} step={0.25}
                onChange={set("mgmtFeeRate")} display={`${inp.mgmtFeeRate.toFixed(2)}%/yr`}
                sub={`Yrs 1–5 on committed · Yrs 6–${inp.fundLife} on deployed only`} />
              <Slider label="Recycling" value={inp.recycleRate} min={0} max={25} step={5}
                onChange={set("recycleRate")}
                display={inp.recycleRate === 0 ? "None" : `${inp.recycleRate}%`}
                sub={inp.recycleRate > 0 ? `+$${out.recycledCapital.toFixed(1)}M recycled → $${out.totalDeployed.toFixed(1)}M total deployed` : "No proceeds recycled back into new investments"} />
              <Slider label="Carry" value={inp.carryRate} min={10} max={30} step={5}
                onChange={set("carryRate")} display={`${inp.carryRate}%`} />
              <Slider label="Fund Life" value={inp.fundLife} min={7} max={15} step={1}
                onChange={set("fundLife")} display={`${inp.fundLife} yrs`} />

              <div className="col-span-full pt-1 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Waterfall Style</p>
                <div className="flex gap-2">
                  {(["american", "european"] as const).map(style => (
                    <button key={style} onClick={() => setInp(p => ({ ...p, waterfall: style }))}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        inp.waterfall === style
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                      }`}>
                      {style === "american" ? "American — deal-by-deal carry" : "European — whole-fund carry"}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {inp.waterfall === "american"
                    ? "Carry paid per exit as each deal clears its cost basis. GP economics arrive earlier."
                    : "Carry withheld until LP recovers all invested capital. Same total carry, later timing."}
                </p>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Returns — Base Case</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <Card label="Gross MOIC" value={mx(inp.grossMoic)} sub="on invested capital" color="blue" />
              <Card label="Gross MOIC on Fund" value={mx(out.grossMoicOnFund)} sub={`on $${inp.fundSize}M committed`} color="blue" />
              <Card label="Gross IRR" value={pct(out.grossIrr)} sub="before fees & carry" color="blue" />
              <Card label="GP Total Economics" value={fm(out.gpTotalEconomics)} sub={`carry + ${fm(out.totalMgmtFees)} fees`} color="amber" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card label="LP Net Proceeds" value={fm(out.lpNetProceeds)} sub={`profit: ${fm(out.lpNetProceeds - inp.fundSize)}`} color="emerald" />
              <Card label="LP Net MOIC" value={mx(out.lpNetMoic)} sub="after fees & carry" color="emerald" />
              <Card label="LP Net IRR" value={pct(out.lpNetIrr)} sub="after fees & carry" color="emerald" />
              <Card label="GP Carry" value={fm(out.gpCarry)} sub={`${inp.carryRate}% × ${fm(out.fundProfit)} profit`} color="amber" />
            </div>
          </div>

          {/* Scenario table */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Scenario Analysis</p>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-44">Metric</th>
                    {scenarios.map(s => (
                      <th key={s.label} className={`text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wide ${s.label === "Base" ? "text-blue-600 bg-blue-50/60" : "text-slate-400"}`}>
                        {s.label}<br /><span className="normal-case font-bold text-sm">{mx(s.moic)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SCENARIO_ROWS.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600 font-medium text-xs">{row.label}</td>
                      {scenarios.map(s => (
                        <td key={s.label} className={`text-center px-4 py-2.5 tabular-nums ${s.label === "Base" ? "font-bold text-slate-900 bg-blue-50/30" : "text-slate-700"}`}>
                          {row.fmt(s.o, s.moic)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash flows */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Annual Cash Flows — Base Case</p>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Year</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-rose-400 uppercase tracking-wide">LP Call</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Gross Exits</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-amber-500 uppercase tracking-wide">GP Carry</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">LP Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {out.rows.map(r => (
                    <tr key={r.year} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500 font-medium">Yr {r.year}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-rose-500">
                        {r.lpCall < -0.001 ? `(${fm(-r.lpCall)})` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {r.grossExits > 0.001 ? fm(r.grossExits) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-600">
                        {r.gpCarryDist > 0.001 ? fm(r.gpCarryDist) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.lpNetCashflow >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {r.lpNetCashflow >= 0 ? fm(r.lpNetCashflow) : `(${fm(-r.lpNetCashflow)})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-700">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-rose-500">
                      ({fm(out.rows.reduce((a, r) => a + Math.max(0, -r.lpCall), 0))})
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-700">
                      {fm(out.grossProceeds)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-600">
                      {fm(out.gpCarry)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${out.lpNetProceeds >= inp.fundSize ? "text-emerald-600" : "text-rose-500"}`}>
                      {fm(out.lpNetProceeds)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              LP calls are parenthesized. Fees: {fm(out.feeCommitted)}/yr on committed capital (yrs 1–{out.feeCommittedYears}),
              then on remaining cost basis only — steps down as each cohort exits, reaching $0 once all investments are realized.
              Total fees: {fm(out.totalMgmtFees)}. Exits distributed uniformly after {inp.holdYears}-yr hold.
            </p>
          </div>
        </div>
      )}

      {/* ── GP P&L Tab ────────────────────────────────────────────────────────── */}
      {tab === "pnl" && <GPPnL />}

    </div>
  );
}
