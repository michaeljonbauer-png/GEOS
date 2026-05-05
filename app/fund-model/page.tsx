"use client";

import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inputs {
  fundSize: number;
  deployYears: number;
  holdYears: number;
  grossMoic: number;
  mgmtFeeRate: number;
  carryRate: number;
  fundLife: number;
  recycleRate: number; // % of invested capital recycled back into new deals
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

// ─── Finance ─────────────────────────────────────────────────────────────────

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
  const { fundSize, deployYears, holdYears, grossMoic, mgmtFeeRate, carryRate, fundLife, recycleRate } = inp;
  const r = mgmtFeeRate / 100;

  // Two-phase fees: years 1–5 on committed capital; years 6+ on remaining cost basis only,
  // dropping to $0 once all investments have exited.
  // cohortYearSum = total outstanding cohort-years in the deployed-fee window, used for closed-form.
  const feeCommittedYears = Math.min(5, fundLife);
  const feeDeployedYears  = Math.max(0, fundLife - feeCommittedYears);
  let cohortYearSum = 0;
  for (let t = feeCommittedYears + 1; t <= fundLife; t++) {
    cohortYearSum += Math.max(0, deployYears - Math.max(0, t - holdYears));
  }
  // Closed-form: investedCapital*(1 + r*cohortYearSum/deployYears) = fundSize*(1 - feeCommittedYears*r)
  const investedCapital = fundSize * (1 - feeCommittedYears * r) / (1 + r * cohortYearSum / Math.max(1, deployYears));
  const feeCommitted    = fundSize * r;
  const totalMgmtFees   = feeCommittedYears * feeCommitted + (investedCapital / Math.max(1, deployYears)) * r * cohortYearSum;

  // Recycling: proceeds from early exits reinvested without additional LP calls
  const recycledCapital = investedCapital * (recycleRate / 100);
  const totalDeployed   = investedCapital + recycledCapital;

  const lpCallPerYear  = investedCapital / deployYears;   // LP only funds investedCapital
  const exitPerCohort  = (totalDeployed / deployYears) * grossMoic; // exits reflect full deployed
  const grossProceeds  = totalDeployed * grossMoic;

  const lpCapital  = fundSize;
  const fundProfit = Math.max(0, grossProceeds - lpCapital);
  const gpCarry    = fundProfit * (carryRate / 100);
  const lpNetProceeds   = grossProceeds - gpCarry;
  const lpNetMoic       = lpNetProceeds / lpCapital;
  const gpTotalEconomics = gpCarry + totalMgmtFees;

  const maxYear = Math.max(fundLife, deployYears + holdYears);
  const inv: number[] = new Array(maxYear + 1).fill(0);
  const exits: number[] = new Array(maxYear + 1).fill(0);

  for (let t = 1; t <= deployYears; t++) inv[t] = lpCallPerYear;
  for (let t = 1; t <= deployYears; t++) {
    const yr = t + holdYears;
    if (yr <= maxYear) exits[yr] += exitPerCohort;
  }

  // American waterfall: return capital first, then split profits
  let lpCapReturned = 0;
  const rows: CashflowRow[] = [];
  const lpIrrCfs  = new Array(maxYear + 1).fill(0);
  const grsIrrCfs = new Array(maxYear + 1).fill(0);

  for (let t = 1; t <= maxYear; t++) {
    let fee = 0;
    if (t <= feeCommittedYears) {
      fee = feeCommitted;
    } else if (t <= fundLife) {
      // Fee on remaining cost basis: only cohorts not yet exited
      const outstanding = Math.max(0, deployYears - Math.max(0, t - holdYears));
      fee = (investedCapital / Math.max(1, deployYears)) * outstanding * r;
    }
    const lpCall    = -(inv[t] + fee);
    const grossExit = exits[t];
    let lpNetDist = 0, gpCarryDist = 0;

    if (grossExit > 0) {
      if (lpCapReturned < lpCapital) {
        const remaining     = lpCapital - lpCapReturned;
        const capReturn     = Math.min(grossExit, remaining);
        const profit        = Math.max(0, grossExit - capReturn);
        lpNetDist           = capReturn + profit * (1 - carryRate / 100);
        gpCarryDist         = profit * (carryRate / 100);
        lpCapReturned      += capReturn;
      } else {
        lpNetDist   = grossExit * (1 - carryRate / 100);
        gpCarryDist = grossExit * (carryRate / 100);
      }
    }

    const lpNetCashflow = lpCall + lpNetDist;
    rows.push({ year: t, lpCall, grossExits: grossExit, gpCarryDist, lpNetCashflow });
    lpIrrCfs[t]  = lpNetCashflow;
    grsIrrCfs[t] = -inv[t] + grossExit;
  }

  return {
    feeCommitted, feeCommittedYears, feeDeployedYears,
    totalMgmtFees, investedCapital, recycledCapital, totalDeployed,
    grossProceeds, grossMoicOnFund: grossProceeds / fundSize,
    grossIrr: calcIrr(grsIrrCfs),
    fundProfit, gpCarry, gpTotalEconomics,
    lpNetProceeds, lpNetMoic, lpNetIrr: calcIrr(lpIrrCfs),
    rows: rows.filter(r => Math.abs(r.lpCall) > 0.001 || r.grossExits > 0.001),
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const fm  = (v: number) => `$${v.toFixed(1)}M`;
const mx  = (v: number) => `${v.toFixed(2)}×`;
const pct = (v: number | null) => v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";

type Color = "blue" | "emerald" | "amber";
const BG: Record<Color, string> = {
  blue:    "bg-blue-50 border-blue-200",
  emerald: "bg-emerald-50 border-emerald-200",
  amber:   "bg-amber-50 border-amber-200",
};
const TXT: Record<Color, string> = {
  blue: "text-blue-800", emerald: "text-emerald-800", amber: "text-amber-800",
};
const SUB: Record<Color, string> = {
  blue: "text-blue-500", emerald: "text-emerald-500", amber: "text-amber-600",
};

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: Color }) {
  return (
    <div className={`rounded-xl border p-4 ${BG[color]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${SUB[color]}`}>{label}</p>
      <p className={`text-2xl font-bold ${TXT[color]}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${SUB[color]}`}>{sub}</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULTS: Inputs = {
  fundSize: 90, deployYears: 3, holdYears: 5, grossMoic: 3.0,
  mgmtFeeRate: 2.0, carryRate: 20, fundLife: 10, recycleRate: 0,
};

export default function FundModelPage() {
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const set = (k: keyof Inputs) => (v: number) => setInp(p => ({ ...p, [k]: v }));

  const out = useMemo(() => runModel(inp), [inp]);

  const scenarios = useMemo(() => [
    { label: "Bear",  moic: inp.grossMoic * 0.65 },
    { label: "Base",  moic: inp.grossMoic },
    { label: "Bull",  moic: inp.grossMoic * 1.40 },
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
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Calculator className="text-blue-500" size={20} />
          <h1 className="text-xl font-bold text-slate-900">GP Fund Model</h1>
        </div>
        <p className="text-sm text-slate-500">Adjust any parameter — returns update instantly. American waterfall (return capital first, then split profits).</p>
      </div>

      {/* Inputs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-5">Parameters</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">

          {/* Fund size */}
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
  );
}
