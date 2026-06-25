"use client";

import { useState, useMemo } from "react";
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

  // Closed-form: investedCapital*(1 + r*cohortYearSum/deployYears) = fundSize*(1 - feeCommittedYears*r)
  const cohortYearSum = Array.from({ length: deployYears }, (_, i) => holdYears + (deployYears - i)).reduce((a, b) => a + b, 0);
  const investedCapital = fundSize * (1 - feeCommittedYears * r) / (1 + r * cohortYearSum / Math.max(1, deployYears));
  const feeCommitted    = fundSize * r;

  const recycledCapital = investedCapital * (recycleRate / 100);
  const totalDeployed   = investedCapital + recycledCapital;

  const grossProceeds = totalDeployed * grossMoic;
  const lpCapital  = fundSize;
  const fundProfit = grossProceeds - lpCapital;
  const gpCarry    = fundProfit * (carryRate / 100);
  const totalMgmtFees = feeCommitted * feeCommittedYears + r * (investedCapital * feeDeployedYears);
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

// ─── GP P&L Types ─────────────────────────────────────────────────────────────

interface FundCol {
  label: string;
  year: number;
  fundSizeM: number;
  mbCashComp: number;
  mbDawEarlyStage: number;
  mbDawOtherFunds: number;
  upfrontDaw: number;
  otherTeamHC: number;
  teamDaw: number;
}

interface GlobalPL {
  mgmtFeeRate: number;
  dawRate: number;
  deployYears: number;
  gpCommitPct: number;
  feeWaiverPct: number;
  priorFeeRetainPct: number;
}

interface FundPL {
  fundSizeK: number;
  mgmtFeeK: number;
  totalDawK: number;
  mbFeeWaiverAnnualK: number;
  totalCashWaiverK: number;
  mbDawEarlyStageK: number;
  mbDawOtherFundsK: number;
  upfrontDawK: number;
  mbDawTotalK: number;
  gpCommitK: number;
  gpFeeWaiverK: number;
  gpOopK: number;
  totalHcK: number;
  priorFeeK: number;
  mgmtFeePostHcK: number;
  remainingDawK: number;
}

const FUND_DEFAULTS: FundCol[] = [
  { label: "Fund 1", year: 2027, fundSizeM: 100, mbCashComp: 700,  mbDawEarlyStage: 7000,  mbDawOtherFunds: 2000, upfrontDaw: 2000, otherTeamHC: 700,  teamDaw: 850  },
  { label: "Fund 2", year: 2030, fundSizeM: 150, mbCashComp: 850,  mbDawEarlyStage: 9000,  mbDawOtherFunds: 3000, upfrontDaw: 0,    otherTeamHC: 1225, teamDaw: 3000 },
  { label: "Fund 3", year: 2033, fundSizeM: 225, mbCashComp: 1000, mbDawEarlyStage: 11000, mbDawOtherFunds: 4000, upfrontDaw: 0,    otherTeamHC: 2144, teamDaw: 5000 },
];

const GLOBAL_PL_DEFAULTS: GlobalPL = {
  mgmtFeeRate: 2.0,
  dawRate: 20.0,
  deployYears: 3,
  gpCommitPct: 1.0,
  feeWaiverPct: 80,
  priorFeeRetainPct: 50,
};

function computePL(col: FundCol, g: GlobalPL, priorMgmtFeeK: number): FundPL {
  const fundSizeK = col.fundSizeM * 1000;
  const mgmtFeeK = fundSizeK * (g.mgmtFeeRate / 100);
  const totalDawK = fundSizeK * (g.dawRate / 100);

  const gpCommitK = fundSizeK * (g.gpCommitPct / 100);
  const gpFeeWaiverK = Math.round(gpCommitK * (g.feeWaiverPct / 100));
  const gpOopK = gpCommitK - gpFeeWaiverK;
  const mbFeeWaiverAnnualK = gpFeeWaiverK / Math.max(1, g.deployYears);

  const mbDawTotalK = col.upfrontDaw + col.mbDawEarlyStage + col.mbDawOtherFunds;

  const totalHcK = col.mbCashComp + col.otherTeamHC;
  const priorFeeK = priorMgmtFeeK * (g.priorFeeRetainPct / 100);
  const mgmtFeePostHcK = mgmtFeeK + priorFeeK - totalHcK;

  const remainingDawK = totalDawK - col.mbDawEarlyStage - col.teamDaw;

  return {
    fundSizeK, mgmtFeeK, totalDawK,
    mbFeeWaiverAnnualK,
    totalCashWaiverK: col.mbCashComp + mbFeeWaiverAnnualK,
    mbDawEarlyStageK: col.mbDawEarlyStage,
    mbDawOtherFundsK: col.mbDawOtherFunds,
    upfrontDawK: col.upfrontDaw,
    mbDawTotalK,
    gpCommitK, gpFeeWaiverK, gpOopK,
    totalHcK, priorFeeK, mgmtFeePostHcK,
    remainingDawK,
  };
}

// ─── GP P&L UI helpers ────────────────────────────────────────────────────────

const fk = (v: number) => v === 0 ? "—" : `$${Math.round(v).toLocaleString()}`;
const fp = (v: number) => `${v.toFixed(1)}%`;

function NumCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <td className="px-3 py-1.5 text-right">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-24 text-right tabular-nums text-sm bg-blue-50 border border-blue-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white"
      />
    </td>
  );
}

// ─── GP P&L Component ─────────────────────────────────────────────────────────

function GPPnL() {
  const [funds, setFunds] = useState<FundCol[]>(FUND_DEFAULTS);
  const [g, setG] = useState<GlobalPL>(GLOBAL_PL_DEFAULTS);
  const [showGlobal, setShowGlobal] = useState(false);

  const setFund = (i: number, field: keyof FundCol, val: number | string) =>
    setFunds(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  const setGlobal = (field: keyof GlobalPL, val: number) =>
    setG(prev => ({ ...prev, [field]: val }));

  const pls = useMemo(() => {
    return funds.map((col, i) => {
      const priorFeeK = i > 0
        ? funds[i - 1].fundSizeM * 1000 * (g.mgmtFeeRate / 100)
        : 0;
      return computePL(col, g, priorFeeK);
    });
  }, [funds, g]);

  type RowDef =
    | { type: "section"; label: string }
    | { type: "input-num"; label: string; note: string; field: keyof FundCol }
    | { type: "input-year"; label: string; note: string; field: keyof FundCol }
    | { type: "calc"; label: string; note: string; get: (pl: FundPL, col: FundCol) => number; bold?: boolean; color?: string }
    | { type: "sub"; label: string; note: string; get: (pl: FundPL, col: FundCol) => number; color?: string };

  const rows: RowDef[] = [
    { type: "section", label: "FUND OVERVIEW" },
    { type: "input-num",  label: "Fund Size ($M)",           note: "Input",                         field: "fundSizeM" },
    { type: "input-year", label: "Launch Year",              note: "Input",                         field: "year" },
    { type: "calc",       label: "Mgmt Fee / Year ($K)",     note: `${g.mgmtFeeRate}% × fund size`, get: pl => pl.mgmtFeeK },
    { type: "calc",       label: "Total DAW Pool ($K)",      note: `${g.dawRate}% × fund size`,     get: pl => pl.totalDawK },

    { type: "section", label: "MB ANNUAL COMPENSATION" },
    { type: "input-num", label: "MB Cash Comp ($K/yr)",      note: "Input",                                                   field: "mbCashComp" },
    { type: "calc",      label: "MB Fee Waiver / Yr ($K)",   note: `GP commit × ${g.feeWaiverPct}% ÷ ${g.deployYears} yrs`,  get: pl => Math.round(pl.mbFeeWaiverAnnualK) },
    { type: "sub",       label: "Total Cash + Fee Waiver",   note: "Annual",                                                  get: pl => Math.round(pl.totalCashWaiverK), color: "blue" },

    { type: "section", label: "MB CARRIED INTEREST (Total Potential)" },
    { type: "input-num", label: "1× Upfront DAW ($K)",       note: "35% unvested DAW · Fund 1 only",  field: "upfrontDaw" },
    { type: "input-num", label: "MB DAW – Early Stage ($K)", note: "% of this fund's carry pool",      field: "mbDawEarlyStage" },
    { type: "input-num", label: "MB DAW – Other Funds ($K)", note: "LE / LEO / LSC allocation",        field: "mbDawOtherFunds" },
    { type: "sub",       label: "MB DAW Total ($K)",          note: "All sources",                      get: pl => pl.mbDawTotalK, color: "purple" },

    { type: "section", label: "GP COMMIT" },
    { type: "calc", label: `Fee Waiver Portion (${g.feeWaiverPct}%)`, note: `${g.feeWaiverPct}% of GP commit`, get: pl => pl.gpFeeWaiverK },
    { type: "calc", label: `OOP Portion (${100 - g.feeWaiverPct}%)`,  note: `${100 - g.feeWaiverPct}% of GP commit`, get: pl => pl.gpOopK },
    { type: "sub",  label: "MB Total GP Commit ($K)",         note: `${g.gpCommitPct}% of fund`,       get: pl => pl.gpCommitK, color: "amber" },

    { type: "section", label: "MANAGEMENT CO P&L (Annual Run-Rate)" },
    { type: "calc",      label: "MB Cash Comp ($K/yr)",       note: "Ref above",                        get: (pl, col) => col.mbCashComp },
    { type: "input-num", label: "Other Team HC ($K/yr)",      note: "VP / Analyst headcount",            field: "otherTeamHC" },
    { type: "sub",       label: "Total HC ($K/yr)",            note: "All team cash comp",                get: pl => pl.totalHcK, color: "rose" },
    { type: "calc",      label: "Mgmt Fee – Current Fund",    note: "Current fund only",                 get: pl => pl.mgmtFeeK },
    { type: "calc",      label: "+ Mgmt Fee from Prior Funds",note: `${g.priorFeeRetainPct}% retained on prior fund`, get: pl => pl.priorFeeK },
    { type: "sub",       label: "Mgmt Fee Net of HC ($K/yr)", note: "House P&L from management fees",    get: pl => Math.round(pl.mgmtFeePostHcK), color: "emerald" },

    { type: "section", label: "DAW ALLOCATION (Total Potential)" },
    { type: "calc",      label: "MB Early Stage DAW ($K)",    note: "Ref above",                         get: (pl, col) => col.mbDawEarlyStage },
    { type: "input-num", label: "Team DAW ($K)",              note: "Non-MB team carry",                 field: "teamDaw" },
    { type: "sub",       label: "Remaining DAW – House ($K)", note: "Total pool less MB + team",         get: pl => pl.remainingDawK, color: "emerald" },
  ];

  const thClass = "px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500";
  const fundColors = ["text-blue-700", "text-indigo-700", "text-violet-700"];
  const fundBg     = ["bg-blue-50/40", "bg-indigo-50/40", "bg-violet-50/40"];

  const subColors: Record<string, string> = {
    blue:    "bg-blue-50   text-blue-900   border-blue-200",
    purple:  "bg-purple-50 text-purple-900 border-purple-200",
    amber:   "bg-amber-50  text-amber-900  border-amber-200",
    rose:    "bg-rose-50   text-rose-900   border-rose-200",
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
  };

  return (
    <div className="space-y-5">
      {/* Global params toggle */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowGlobal(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Global Parameters</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Mgmt fee {fp(g.mgmtFeeRate)} · DAW {fp(g.dawRate)} · GP commit {fp(g.gpCommitPct)} ·
              Deploy {g.deployYears} yrs · Fee waiver {fp(g.feeWaiverPct)} · Prior fund retain {fp(g.priorFeeRetainPct)}
            </p>
          </div>
          {showGlobal ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {showGlobal && (
          <div className="px-5 pb-5 pt-1 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
            {([
              { label: "Mgmt Fee Rate", field: "mgmtFeeRate" as const, min: 1, max: 3, step: 0.25, display: fp(g.mgmtFeeRate) },
              { label: "DAW / Carry Rate", field: "dawRate" as const, min: 15, max: 30, step: 2.5, display: fp(g.dawRate) },
              { label: "GP Commit %", field: "gpCommitPct" as const, min: 0.5, max: 3, step: 0.25, display: fp(g.gpCommitPct) },
              { label: "Deploy Years", field: "deployYears" as const, min: 2, max: 5, step: 1, display: `${g.deployYears} yrs` },
              { label: "Fee Waiver %", field: "feeWaiverPct" as const, min: 50, max: 100, step: 5, display: fp(g.feeWaiverPct) },
              { label: "Prior Fund Retain %", field: "priorFeeRetainPct" as const, min: 0, max: 100, step: 10, display: fp(g.priorFeeRetainPct) },
            ] as const).map(s => (
              <Slider key={s.field} label={s.label} value={g[s.field]} min={s.min} max={s.max} step={s.step}
                onChange={v => setGlobal(s.field, v)} display={s.display} />
            ))}
          </div>
        )}
      </div>

      {/* Main P&L table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-56">Line Item</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-300 w-44 hidden lg:table-cell">Note / Formula</th>
              {funds.map((f, i) => (
                <th key={i} className={`${thClass} ${fundColors[i]} w-32`}>
                  {f.label}<br />
                  <span className="font-bold text-sm normal-case">{f.year}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.type === "section") {
                return (
                  <tr key={ri} className="bg-slate-100">
                    <td colSpan={5} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              if (row.type === "input-num" || row.type === "input-year") {
                const field = row.field;
                return (
                  <tr key={ri} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-1.5 text-xs font-medium text-slate-700">{row.label}</td>
                    <td className="px-3 py-1.5 text-[10px] text-slate-400 hidden lg:table-cell">{row.note}</td>
                    {funds.map((f, i) => (
                      <NumCell
                        key={i}
                        value={f[field] as number}
                        onChange={v => setFund(i, field, v)}
                      />
                    ))}
                  </tr>
                );
              }

              if (row.type === "calc") {
                return (
                  <tr key={ri} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-1.5 text-xs text-slate-600">{row.label}</td>
                    <td className="px-3 py-1.5 text-[10px] text-slate-400 hidden lg:table-cell">{row.note}</td>
                    {pls.map((pl, i) => (
                      <td key={i} className={`px-4 py-1.5 text-right tabular-nums text-xs text-slate-700 ${fundBg[i]}`}>
                        {fk(row.get(pl, funds[i]))}
                      </td>
                    ))}
                  </tr>
                );
              }

              if (row.type === "sub") {
                const cc = subColors[row.color ?? "blue"];
                return (
                  <tr key={ri} className={`border-t-2 ${cc.includes("blue") ? "border-blue-200" : cc.includes("purple") ? "border-purple-200" : cc.includes("amber") ? "border-amber-200" : cc.includes("rose") ? "border-rose-200" : "border-emerald-200"}`}>
                    <td className={`px-4 py-2 text-xs font-bold ${cc}`}>{row.label}</td>
                    <td className={`px-3 py-2 text-[10px] hidden lg:table-cell ${cc}`}>{row.note}</td>
                    {pls.map((pl, i) => (
                      <td key={i} className={`px-4 py-2 text-right tabular-nums text-sm font-bold ${cc}`}>
                        {fk(row.get(pl, funds[i]))}
                      </td>
                    ))}
                  </tr>
                );
              }

              return null;
            })}
          </tbody>
        </table>
      </div>

      {/* House vs Team summary cards */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">House vs. Team Summary</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {funds.map((f, i) => {
            const pl = pls[i];
            const houseCash = Math.round(pl.mgmtFeePostHcK);
            const houseDaw = pl.remainingDawK;
            const mbTotal = Math.round(pl.totalCashWaiverK) + pl.mbDawTotalK;
            const teamHcTotal = f.otherTeamHC;
            const teamDawTotal = f.teamDaw;
            const totalGpEcon = houseCash + houseDaw + mbTotal + teamHcTotal + teamDawTotal;
            const houseSharePct = totalGpEcon > 0 ? ((houseCash + houseDaw) / totalGpEcon * 100).toFixed(0) : "—";

            return (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-sm font-bold ${fundColors[i]}`}>{f.label} · {f.year}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-semibold">${f.fundSizeM}M fund</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                    <span className="text-slate-500">House — fee net of HC</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">{fk(houseCash)}<span className="text-slate-400 font-normal">/yr</span></span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                    <span className="text-slate-500">House — remaining DAW</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">{fk(houseDaw)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                    <span className="text-slate-500">MB total (comp + DAW)</span>
                    <span className="font-semibold text-blue-700 tabular-nums">{fk(mbTotal)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Team HC cost</span>
                    <span className="font-semibold text-rose-600 tabular-nums">{fk(teamHcTotal)}<span className="text-slate-400 font-normal">/yr</span></span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Team DAW</span>
                    <span className="font-semibold text-purple-700 tabular-nums">{fk(teamDawTotal)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">House share of GP econ</span>
                  <span className="text-base font-black text-emerald-700">{houseSharePct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        All figures in $K. Blue cells are inputs — edit directly. Calculated cells update instantly.
        DAW figures are total potential carry, not present value. "Mgmt Fee Net of HC" is the annual house P&amp;L
        from management company operations after all cash compensation.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULTS: Inputs = {
  fundSize: 90, deployYears: 3, holdYears: 5, grossMoic: 3.0,
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
