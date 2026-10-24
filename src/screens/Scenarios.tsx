// Screen 4 — Scenarios & sensitivity: global levers, tornado, Monte Carlo, saved scenarios.
import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, legendText } from '../components/charts';
import { AnimatedNumber, Card, ChartCard, InfoTip, SliderInput } from '../components/ui';
import { fmtM, fmtMonths, fmtPct, tickM } from '../lib/format';
import { computePortfolio, defaultScenario } from '../model/portfolio';
import { histogram, monteCarlo, tornado, type MonteCarloResult } from '../model/sensitivity';
import type { Globals, ScenarioState } from '../model/types';
import { MAX_SAVED, useScenario } from '../state/ScenarioContext';

const LEVERS: { key: keyof Globals; label: string; min: number; max: number; step: number; pct: boolean; help: string }[] = [
  { key: 'discountRate', label: 'Discount rate', min: 0.03, max: 0.2, step: 0.005, pct: true, help: 'r in every NPV. Course default 10%.' },
  { key: 'haircutDelta', label: 'Haircut change (pts)', min: -0.15, max: 0.3, step: 0.01, pct: true, help: 'Added to each use case’s haircut (20% / 25%).' },
  { key: 'benefitAdj', label: 'Benefit adjustment', min: -0.5, max: 0.5, step: 0.01, pct: true, help: 'Scales every use case’s net annual value.' },
  { key: 'investAdj', label: 'Investment adjustment', min: -0.3, max: 0.5, step: 0.01, pct: true, help: 'Scales every Year-0 investment.' },
  { key: 'adoptionRamp', label: 'Adoption ramp (Year-1 value)', min: 0.3, max: 1, step: 0.01, pct: true, help: 'Share of full value reached in Year 1. Later use cases lag the pilot (ramp²).' },
  { key: 'delayMonths', label: 'Months of delay', min: 0, max: 12, step: 1, pct: false, help: 'Value that starts later is lost from Year 1.' },
];

/** Ready-made scenarios for Q&A. */
function presets(): ScenarioState[] {
  const base = defaultScenario('Base');
  const cfo = defaultScenario('CFO pessimist');
  cfo.globals = { ...cfo.globals, benefitAdj: -0.2, investAdj: 0.15, haircutDelta: 0.1, adoptionRamp: 0.6 };
  const fast = defaultScenario('Fast adoption');
  fast.approaches.sharedDataLayer = true;
  fast.approaches.sourcing.fincrime = 'buy';
  const swap = defaultScenario('Swap Fin Crime for Contact Center');
  swap.funded.fincrime = false;
  swap.funded.contact = true;
  return [base, cfo, fast, swap];
}

export default function Scenarios() {
  const { state, result, dispatch, saved, saveScenario, deleteSaved } = useScenario();
  const reduce = useReducedMotion();
  const t = result.totals;

  // ---- Tornado ----
  const bars = useMemo(() => tornado(state).map((b) => ({ ...b, lowDelta: b.low - b.base, highDelta: b.high - b.base })), [state]);

  // ---- Monte Carlo (re-runs when inputs change; histogram fills in over ~1.2 s) ----
  const [draws, setDraws] = useState(2500);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [shown, setShown] = useState(0);
  const [seed, setSeed] = useState(2030);
  const frame = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const res = monteCarlo(state, draws, seed);
      setMc(res);
      cancelAnimationFrame(frame.current);
      if (reduce) return setShown(res.draws.length);
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1200);
        setShown(Math.round(p * res.draws.length));
        if (p < 1) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }, 250);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [state, draws, seed, reduce]);

  const hist = useMemo(() => {
    if (!mc) return [];
    const lo = Math.min(...mc.draws);
    const hi = Math.max(...mc.draws);
    return histogram(mc.draws.slice(0, shown), lo, hi, 40).map((b) => ({ mid: (b.x0 + b.x1) / 2, count: b.count, neg: b.x1 <= 0 }));
  }, [mc, shown]);

  // ---- Saved scenarios ----
  const [name, setName] = useState(state.name === 'Base' ? '' : state.name);
  const compareList = [{ ...state, name: `${state.name} (current)` }, ...saved];
  const compared = compareList.map((s) => ({ s, r: computePortfolio(s).totals }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Card
          title="Global levers"
          subtitle="Apply to every use case."
          actions={<button className="btn !py-1 text-xs" onClick={() => LEVERS.forEach((l) => dispatch({ type: 'setGlobal', key: l.key, value: defaultScenario().globals[l.key] }))}>↺ Reset levers</button>}
        >
          <div className="space-y-3">
            {LEVERS.map((l) => {
              const v = state.globals[l.key];
              const changed = v !== defaultScenario().globals[l.key];
              return (
                <div key={l.key} className={`rounded-lg px-2 py-1 ${changed ? 'bg-gold/15 ring-1 ring-gold/60' : ''}`}>
                  <div className="flex items-center text-sm font-medium">
                    {l.label}
                    <InfoTip text={l.help} label={`About ${l.label}`} />
                  </div>
                  <SliderInput ariaLabel={l.label} value={v} min={l.min} max={l.max} step={l.step} pct={l.pct} onChange={(x) => dispatch({ type: 'setGlobal', key: l.key, value: x })} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-cream p-3 text-center dark:bg-night">
            <Mini label="NPV" value={t.npv} f={(x) => fmtM(x, 2)} />
            <Mini label="Risk-adj ROI" value={t.riskAdjRoi} f={(x) => fmtPct(x)} />
            <Mini label="Payback" value={t.payback} f={fmtMonths} />
          </div>
        </Card>

        <ChartCard title="Tornado: what moves portfolio NPV most" subtitle={`Each funded driver flexed ±20%. Bars show the change from today’s NPV of ${fmtM(t.npv, 2)}.`}>
          <div className="h-[430px]">
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap="22%">
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" {...AXIS} tickFormatter={tickM} />
                <YAxis type="category" dataKey="label" {...AXIS} width={250} tick={{ ...AXIS.tick, fontSize: 11 }} tickLine={false} />
                <ReferenceLine x={0} stroke="var(--axis)" />
                <Tooltip formatter={(v: number, n: string) => [`${v >= 0 ? '+' : ''}${fmtM(v, 2)}`, n]} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
                <Legend verticalAlign="top" height={28} formatter={legendText} />
                <Bar dataKey="lowDelta" name="Driver −20%" stackId="t" fill="var(--c4)" radius={4} animationDuration={500} />
                <Bar dataKey="highDelta" name="Driver +20%" stackId="t" fill="var(--c3)" radius={4} animationDuration={500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Monte Carlo: range of portfolio NPV"
        subtitle="Every funded driver drawn from a triangular distribution: benefit drivers between the downside and upside benefit bounds (e.g. 0.6×–1.3×), cost drivers between the investment bounds (0.9×–1.25×)."
        actions={
          <>
            <select className="num-input !w-auto !text-left" aria-label="Number of draws" value={draws} onChange={(e) => setDraws(Number(e.target.value))}>
              {[1000, 2500, 5000, 10000].map((n) => <option key={n} value={n}>{n.toLocaleString()} draws</option>)}
            </select>
            <button className="btn-primary !py-1 text-xs" onClick={() => setSeed((s) => s + 1)}>↻ Re-run</button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 20, right: 12, left: 4, bottom: 0 }} barCategoryGap={1}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="mid" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={tickM} />
                <YAxis {...AXIS} width={44} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, 'Draws']} labelFormatter={(v: number) => `NPV ≈ ${fmtM(v, 1)}`} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
                <Bar dataKey="count" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                  {hist.map((b, i) => <Cell key={i} fill={b.neg ? 'var(--bad)' : 'var(--c1)'} />)}
                </Bar>
                {mc && (
                  <>
                    <ReferenceLine x={mc.p10} stroke="var(--axis)" strokeDasharray="4 3" label={{ value: 'P10', position: 'top', fill: 'var(--axis)', fontSize: 11 }} />
                    <ReferenceLine x={mc.p50} stroke="var(--ink)" label={{ value: 'P50', position: 'top', fill: 'var(--ink)', fontSize: 11 }} />
                    <ReferenceLine x={mc.p90} stroke="var(--axis)" strokeDasharray="4 3" label={{ value: 'P90', position: 'top', fill: 'var(--axis)', fontSize: 11 }} />
                    {mc.draws.some((d) => d < 0) && <ReferenceLine x={0} stroke="var(--bad)" />}
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {mc && (
            <dl className="grid grid-cols-2 content-start gap-3 lg:grid-cols-1">
              <Stat label="P10 (1-in-10 worse)" value={fmtM(mc.p10, 2)} />
              <Stat label="P50 (median)" value={fmtM(mc.p50, 2)} />
              <Stat label="P90 (1-in-10 better)" value={fmtM(mc.p90, 2)} />
              <Stat
                label="Probability NPV < 0"
                value={fmtPct(mc.probNegative, 1)}
                tone={mc.probNegative > 0.1 ? 'bad' : 'good'}
                note={mc.probNegative > 0.1 ? '▼ Material loss risk' : '▲ Low loss risk'}
              />
              <p className="col-span-2 text-xs text-ink-muted lg:col-span-1">
                {shown.toLocaleString()} of {mc.draws.length.toLocaleString()} draws shown. Green bins: NPV ≥ 0; red bins: NPV &lt; 0.
              </p>
            </dl>
          )}
        </div>
      </ChartCard>

      <Card title="Save and compare scenarios" subtitle={`Save up to ${MAX_SAVED} named scenarios in this browser and compare them with the current one. Saving a name that exists overwrites it.`}>
        <div className="flex flex-wrap items-center gap-2">
          <input className="num-input !w-64 !text-left" placeholder="Scenario name, e.g. CFO pessimist" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scenario name" />
          <button className="btn-primary" disabled={!name.trim()} onClick={() => saveScenario(name.trim())}>Save current</button>
          <span className="mx-2 h-6 w-px bg-black/10 dark:bg-night-line" />
          <span className="label">Load preset:</span>
          {presets().map((p) => (
            <button key={p.name} className="btn !py-1 text-xs" onClick={() => { dispatch({ type: 'load', state: p }); setName(p.name); }}>
              {p.name}
            </button>
          ))}
        </div>
        {saved.length >= MAX_SAVED && <p className="mt-2 text-xs text-gold-600 dark:text-gold">{MAX_SAVED} scenarios saved; saving a new name replaces the oldest.</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className="label py-1 text-left">Metric</th>
                {compared.map(({ s }, i) => (
                  <th key={i} className="py-1 text-right align-bottom">
                    <div className="font-semibold">{s.name}</div>
                    {i > 0 && (
                      <div className="mt-1 flex justify-end gap-1">
                        <button className="text-xs text-brand underline dark:text-[#4CC38A]" onClick={() => dispatch({ type: 'load', state: s })}>load</button>
                        <button className="text-xs text-stop underline dark:text-stop-dark" onClick={() => deleteSaved(i - 1)} aria-label={`Delete ${s.name}`}>delete</button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {([
                ['Funded', (s: ScenarioState) => Object.entries(s.funded).filter(([, v]) => v).length + ' use cases'],
                ['Year-0 investment', (_s: ScenarioState, r: typeof t) => fmtM(r.year0, 2)],
                ['Net / yr', (_s: ScenarioState, r: typeof t) => fmtM(r.net, 2)],
                ['3-yr NPV', (_s: ScenarioState, r: typeof t) => fmtM(r.npv, 2)],
                ['Payback', (_s: ScenarioState, r: typeof t) => fmtMonths(r.payback)],
                ['Risk-adj NPV', (_s: ScenarioState, r: typeof t) => fmtM(r.riskAdjNpv, 2)],
                ['Risk-adj ROI', (_s: ScenarioState, r: typeof t) => fmtPct(r.riskAdjRoi)],
                ['Downside → upside', (_s: ScenarioState, r: typeof t) => `${fmtM(r.downsideNpv)} → ${fmtM(r.upsideNpv)}`],
              ] as [string, (s: ScenarioState, r: typeof t) => string][]).map(([label, f]) => (
                <tr key={label} className="border-t border-black/5 dark:border-night-line">
                  <td className="py-1.5 text-ink-soft dark:text-[#AEB7B2]">{label}</td>
                  {compared.map(({ s, r }, i) => <td key={i} className="py-1.5 text-right font-medium">{f(s, r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {compared.length > 1 && (
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer>
              <BarChart data={compared.map(({ s, r }) => ({ name: s.name, npv: r.npv, risk: r.riskAdjNpv, down: r.downsideNpv }))} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="name" {...AXIS} tick={{ ...AXIS.tick, fontSize: 11 }} interval={0} />
                <YAxis {...AXIS} tickFormatter={tickM} width={56} />
                <ReferenceLine y={0} stroke="var(--axis)" />
                <Tooltip formatter={(v: number) => fmtM(v, 2)} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
                <Legend formatter={legendText} />
                <Bar dataKey="down" name="Downside NPV" fill="var(--c4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="risk" name="Risk-adj NPV" fill="var(--c2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="npv" name="Base NPV" fill="var(--c1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function Mini({ label, value, f }: { label: string; value: number; f: (v: number) => string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="font-serif text-lg font-bold"><AnimatedNumber value={value} format={f} /></div>
    </div>
  );
}

function Stat({ label, value, tone, note }: { label: string; value: string; tone?: 'good' | 'bad'; note?: string }) {
  return (
    <div className="rounded-lg bg-cream p-2 dark:bg-night">
      <dt className="text-xs text-ink-muted dark:text-[#9AA39E]">{label}</dt>
      <dd className="font-serif text-xl font-bold tabular-nums">{value}</dd>
      {note && <dd className={`text-xs font-semibold ${tone === 'bad' ? 'text-stop dark:text-stop-dark' : 'text-ok dark:text-ok-dark'}`}>{note}</dd>}
    </div>
  );
}
