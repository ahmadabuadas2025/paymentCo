// Screen 7 — Budget & roadmap: editable 9×3 budget and the gated funding timeline.
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, legendText } from '../components/charts';
import { Card, ChartCard, MoneyInput, StatusPill } from '../components/ui';
import { fmtM, fmtPct, tickM } from '../lib/format';
import { BUDGET_CATEGORIES, BUDGET_TOTAL, TECH_SHARE_LIMIT, summarizeBudget } from '../model/budget';
import { getUseCase } from '../model/useCases';
import { useScenario } from '../state/ScenarioContext';

export default function BudgetRoadmap() {
  const { state, result, dispatch } = useScenario();
  const b = state.budget;
  const s = summarizeBudget(b);
  const [replay, setReplay] = useState(0);

  const byYear = [0, 1, 2].map((y) => {
    const people = b.reduce((sum, row, i) => sum + (BUDGET_CATEGORIES[i].kind === 'people' ? row[y] : 0), 0);
    return { year: `Year ${y + 1}`, tech: s.yearTotals[y] - people, people, total: s.yearTotals[y] };
  });

  // Roadmap tranches: the pilot use case's Year-0 first, the rest of Year 1 at Day 90, Years 2-3 at the Year-1 gate.
  const pilotId = state.approaches.pilotFirst;
  const pilot = result.useCases.find((r) => r.id === pilotId)!;
  const pilotFunds = state.funded[pilotId] ? Math.min(pilot.year0, s.yearTotals[0]) : 0;
  const others = result.funded.filter((r) => r.id !== pilotId);
  const phases = [
    {
      when: 'Days 0–90',
      title: `${getUseCase(pilotId).short} pilot`,
      funds: pilotFunds,
      body: `Build and run the ${getUseCase(pilotId).short} pilot on one queue; stand up model-risk controls and the AI inventory.`,
      gate: 'Day-90 gate: cycle time ≤ 2 days, rework < 8%, overrides 2–25%, zero Reg E misses',
    },
    {
      when: 'Rest of Year 1',
      title: 'Build the portfolio',
      funds: s.yearTotals[0] - pilotFunds,
      body: `Release the remaining Year-1 budget: ${others.map((r) => `${getUseCase(r.id).short} (${fmtM(r.year0)})`).join(', ') || 'no other funded builds'}, plus training and change.`,
      gate: 'Year-1 gate: realised value on track vs plan, model validations passed',
    },
    {
      when: 'Years 2–3',
      title: 'Scale and extend',
      funds: s.yearTotals[1] + s.yearTotals[2],
      body: 'Scale proven use cases to every client institution; consider the deferred Contact Center once staff acceptance improves.',
      gate: 'Annual board review against NPV and risk-adjusted ROI',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card
          title="$15M three-year budget"
          subtitle="Edit any cell ($M). Group 1 Portfolio Summary defaults."
          actions={<button className="btn !py-1 text-xs" onClick={() => dispatch({ type: 'resetBudget' })}>↺ Reset budget</button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="label py-1 text-left">Category</th>
                  {['Year 1', 'Year 2', 'Year 3'].map((y) => <th key={y} className="label w-28 py-1 text-right">{y}</th>)}
                  <th className="label w-24 py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {BUDGET_CATEGORIES.map((c, i) => {
                  const changed = b[i].some((v, y) => v !== c.defaults[y]);
                  return (
                    <tr key={c.name} className={`border-t border-black/5 dark:border-night-line ${changed ? 'bg-gold/10' : ''}`}>
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">
                          {c.name}
                          {c.kind === 'people' && <span className="ml-2 rounded bg-brand-100 px-1.5 text-[10px] font-semibold uppercase text-brand dark:bg-[#2BA675]/20 dark:text-[#4CC38A]">people & controls</span>}
                        </div>
                        <div className="text-xs text-ink-muted">{c.note}</div>
                      </td>
                      {[0, 1, 2].map((y) => (
                        <td key={y} className="px-1 py-1.5">
                          <MoneyInput value={b[i][y]} label={`${c.name} year ${y + 1}`} onChange={(v) => dispatch({ type: 'setBudget', row: i, year: y, value: v })} />
                        </td>
                      ))}
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmtM(b[i][0] + b[i][1] + b[i][2], 2)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-black/20 font-bold dark:border-night-line">
                  <td className="py-2">Total</td>
                  {s.yearTotals.map((v, y) => <td key={y} className="py-2 pr-2 text-right tabular-nums">{fmtM(v, 2)}</td>)}
                  <td className="py-2 text-right tabular-nums">{fmtM(s.total, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Budget checks">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <StatusPill ok={s.balanced} okText="Adds to $15.0M" badText={s.total > BUDGET_TOTAL ? 'Over' : 'Under'} />
                <span>{s.balanced ? 'The plan uses exactly the $15.0M.' : `Total is ${fmtM(s.total, 2)}: ${fmtM(Math.abs(BUDGET_TOTAL - s.total), 2)} ${s.total > BUDGET_TOTAL ? 'over' : 'under'} the $15.0M.`}</span>
              </li>
              <li className="flex items-start gap-2">
                <StatusPill ok={!s.techHeavy} okText="Balanced mix" badText="Tech-heavy" />
                <span>
                  People and controls (training + change + model risk): <strong>{fmtPct(s.peopleShare)}</strong>. Technology: {fmtPct(s.techShare)}.
                  {s.techHeavy && ` Over ${fmtPct(TECH_SHARE_LIMIT)} on technology: the course warns a tech-heavy budget fails the COO.`}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StatusPill ok={result.totals.year0 <= s.yearTotals[0]} okText="Builds fit Y1" badText="Builds > Y1" />
                <span>Year-0 builds {fmtM(result.totals.year0, 2)} vs Year-1 budget {fmtM(s.yearTotals[0], 2)}.</span>
              </li>
            </ul>
          </Card>
          <ChartCard title="Spend by year" subtitle="Technology vs people and controls.">
            <div className="h-[230px]">
              <ResponsiveContainer>
                <BarChart data={byYear} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="year" {...AXIS} tickLine={false} />
                  <YAxis {...AXIS} tickFormatter={tickM} width={52} />
                  <Tooltip formatter={(v: number) => fmtM(v, 2)} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
                  <Legend formatter={legendText} />
                  <Bar dataKey="tech" name="Technology" stackId="y" fill="var(--c3)" animationDuration={500} />
                  <Bar dataKey="people" name="People & controls" stackId="y" fill="var(--c1)" radius={[4, 4, 0, 0]} animationDuration={500}>
                    <LabelList dataKey="total" position="top" formatter={(v: number) => fmtM(v)} style={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      <Card
        title="Roadmap: money follows evidence"
        subtitle="Each tranche is released only when the gate before it passes."
        actions={<button className="btn !py-1 text-xs" onClick={() => setReplay((r) => r + 1)}>↻ Replay</button>}
      >
        <div key={replay} className="relative">
          <motion.div
            className="absolute left-0 right-0 top-[18px] h-1 origin-left rounded bg-gold"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
          <div className="relative grid gap-4 md:grid-cols-3">
            {phases.map((p, i) => (
              <motion.div key={p.when} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.45, duration: 0.45 }}>
                <div className="flex items-center gap-2">
                  <span className="z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-gold bg-white font-bold text-brand dark:bg-night-card dark:text-white">{i + 1}</span>
                  <span className="label rounded bg-cream px-2 py-0.5 dark:bg-night">{p.when}</span>
                </div>
                <div className="mt-3 rounded-lg border border-black/10 p-3 dark:border-night-line">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-serif text-lg font-bold">{p.title}</h4>
                    <span className="font-serif text-xl font-bold tabular-nums text-brand dark:text-[#4CC38A]">{fmtM(p.funds)}</span>
                  </div>
                  <p className="muted mt-1 text-sm">{p.body}</p>
                  <p className="mt-2 rounded bg-gold/15 px-2 py-1 text-xs font-medium">🔒 {p.gate}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
