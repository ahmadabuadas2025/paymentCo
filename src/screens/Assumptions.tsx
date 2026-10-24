// Screen 8 — Assumptions: every input, its value, its source and whether it changed.
import { useState } from 'react';
import { Card, Segmented } from '../components/ui';
import { fmtDriver, fmtPct } from '../lib/format';
import { BUDGET_CATEGORIES } from '../model/budget';
import { DEFAULT_GLOBALS, defaultApproaches } from '../model/portfolio';
import { GROUP_LABELS, USE_CASES } from '../model/useCases';
import { useScenario } from '../state/ScenarioContext';

export default function Assumptions() {
  const { state, dispatch } = useScenario();
  const [filter, setFilter] = useState<'all' | 'changed'>('all');
  const [q, setQ] = useState('');

  const rows = USE_CASES.flatMap((u) =>
    u.drivers.map((d) => ({ u, d, value: state.drivers[u.id][d.id], changed: state.drivers[u.id][d.id] !== d.value })),
  ).filter((r) => (filter === 'all' || r.changed) && `${r.u.short} ${r.d.id} ${r.d.label} ${r.d.source}`.toLowerCase().includes(q.toLowerCase()));

  const changedCount = USE_CASES.reduce((n, u) => n + u.drivers.filter((d) => state.drivers[u.id][d.id] !== d.value).length, 0);
  const globalsChanged = (Object.keys(DEFAULT_GLOBALS) as (keyof typeof DEFAULT_GLOBALS)[]).filter((k) => state.globals[k] !== DEFAULT_GLOBALS[k]);
  const da = defaultApproaches();
  const a = state.approaches;
  const approachChanges = [
    a.pilotFirst !== da.pilotFirst && `Pilot first: ${a.pilotFirst}`,
    a.humanReview !== da.humanReview && `Human review: ${a.humanReview}`,
    a.sharedDataLayer && 'Shared data layer: on',
    ...USE_CASES.filter((u) => a.sourcing[u.id] === 'buy').map((u) => `${u.short}: buy`),
  ].filter(Boolean) as string[];
  const fundedChanges = USE_CASES.filter((u) => state.funded[u.id] !== u.defaultFunded).map((u) => `${u.short}: ${state.funded[u.id] ? 'funded' : 'deferred'}`);
  const budgetChanges = BUDGET_CATEGORIES.filter((c, i) => state.budget[i].some((v, y) => v !== c.defaults[y])).map((c) => c.name);

  return (
    <div className="space-y-4">
      <Card title="What differs from the base case" subtitle={`Scenario “${state.name}”.`}
        actions={<button className="btn" onClick={() => dispatch({ type: 'resetAll' })}>↺ Reset everything to base</button>}>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li><strong>{changedCount}</strong> driver input{changedCount === 1 ? '' : 's'} changed</li>
          <li><strong>Global levers:</strong> {globalsChanged.length ? globalsChanged.map((k) => `${k} = ${k === 'delayMonths' ? state.globals[k] : fmtPct(state.globals[k], 1)}`).join(', ') : 'all at default'}</li>
          <li><strong>Approaches:</strong> {approachChanges.length ? approachChanges.join(', ') : 'all at default'}</li>
          <li><strong>Funding:</strong> {fundedChanges.length ? fundedChanges.join(', ') : 'Fraud, Disputes, Fin Crime (team plan)'}</li>
          <li><strong>Budget:</strong> {budgetChanges.length ? `edited: ${budgetChanges.join(', ')}` : 'workbook allocation'}</li>
        </ul>
      </Card>

      <Card
        title="Every input"
        subtitle="Value, default, source, and whether it was changed."
        actions={
          <>
            <input className="num-input !w-56 !text-left" placeholder="Search inputs or sources" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inputs" />
            <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'changed', label: `Changed (${changedCount})` }]} />
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left">
                {['Use case', 'ID', 'Input', 'Line', 'Value', 'Default', 'Source', 'Status'].map((h) => <th key={h} className="label py-1 pr-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, d, value, changed }) => (
                <tr key={`${u.id}.${d.id}`} className={`border-t border-black/5 dark:border-night-line ${changed ? 'bg-gold/10' : ''}`}>
                  <td className="py-1 pr-2">{u.short}</td>
                  <td className="py-1 pr-2 font-mono text-xs">{d.id}</td>
                  <td className="py-1 pr-2">{d.label}</td>
                  <td className="py-1 pr-2 text-xs text-ink-muted">{GROUP_LABELS[d.group]}</td>
                  <td className="py-1 pr-2 text-right font-semibold tabular-nums">{fmtDriver(value, d.unit)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-ink-muted">{fmtDriver(d.value, d.unit)}</td>
                  <td className="py-1 pr-2 text-xs">{d.source}</td>
                  <td className="py-1">
                    {changed ? (
                      <button className="whitespace-nowrap text-xs font-semibold text-gold-600 underline dark:text-gold" onClick={() => dispatch({ type: 'resetDriver', id: u.id, key: d.id })}>
                        ● changed · reset
                      </button>
                    ) : (
                      <span className="text-xs text-ink-muted">default</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No inputs match.</p>}
        </div>
      </Card>

      <Card title="Model assumptions added by this simulator" subtitle="Not in the class workbook; documented so the board can challenge them.">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Deferred use cases (Contact Center, Client Growth, Product Dev, Finance Intel) use team placeholder lump sums.</li>
          <li>Adoption ramp affects Year 1 only; Years 2–3 reach full value. Later use cases lag the pilot (ramp²). Delay removes months/12 of Year-1 value.</li>
          <li>Buy = Year-0 × 0.7, operating cost × 1.25, +20 pts Year-1 adoption. Human review: sampled = opex × 0.9, risk × 1.4; auto-route = opex × 0.8, risk × 2.0.</li>
          <li>Shared data layer cuts integration + data Year-0 lines by 15% for every use case after the pilot; lump-sum use cases assume half of Year-0 is integration + data.</li>
          <li>Monte Carlo: independent triangular draws per driver (benefit drivers on the benefit bounds, cost drivers on the investment bounds); shares capped at 100%.</li>
          <li>The 90-day pilot simulator is an illustrative operations model calibrated so the default settings hit the case targets (5.2 → ~2 days, 18% → under 8% rework).</li>
        </ul>
      </Card>
    </div>
  );
}
