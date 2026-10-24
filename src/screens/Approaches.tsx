// Screen 5 — Approaches: switches that change how the model works, each with its documented effect.
import { useMemo, type ReactNode } from 'react';
import { Card, Segmented, Toggle } from '../components/ui';
import { fmtM, fmtMonths, fmtPct } from '../lib/format';
import { APPROACH_EFFECTS, computePortfolio, defaultApproaches, rolloutOrder } from '../model/portfolio';
import { USE_CASES, getUseCase } from '../model/useCases';
import type { Approaches, HumanReview, ScenarioState } from '../model/types';
import { useScenario } from '../state/ScenarioContext';

/** Portfolio NPV with one part of the approaches replaced, to show each switch's own effect. */
function npvWith(state: ScenarioState, patch: Partial<Approaches>) {
  return computePortfolio({ ...state, approaches: { ...state.approaches, ...patch } }).totals;
}

function Delta({ now, before }: { now: number; before: number }) {
  const d = now - before;
  if (Math.abs(d) < 1) return <span className="text-xs text-ink-muted">no change to NPV</span>;
  const up = d > 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-ok dark:text-ok-dark' : 'text-stop dark:text-stop-dark'}`}>
      {up ? '▲' : '▼'} {fmtM(Math.abs(d), 2)} NPV vs default
    </span>
  );
}

function Effect({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-cream p-3 text-sm dark:bg-night">{children}</p>;
}

export default function ApproachesScreen() {
  const { state, result, dispatch } = useScenario();
  const a = state.approaches;
  const def = defaultApproaches();
  const t = result.totals;
  const base = useMemo(() => computePortfolio({ ...state, approaches: defaultApproaches() }).totals, [state]);
  const buy = APPROACH_EFFECTS.buy;
  const order = rolloutOrder(a).filter((id) => state.funded[id]);

  return (
    <div className="space-y-4">
      <Card title="Effect of all approach choices" subtitle="Current switches compared with the default approach (build everything, Disputes first, every case reviewed, no shared data layer).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['3-yr NPV', fmtM(t.npv, 2), fmtM(base.npv, 2)],
            ['Year-0', fmtM(t.year0, 2), fmtM(base.year0, 2)],
            ['Net / yr', fmtM(t.net, 2), fmtM(base.net, 2)],
            ['Payback', fmtMonths(t.payback), fmtMonths(base.payback)],
          ].map(([label, now, was]) => (
            <div key={label} className="rounded-lg bg-cream p-3 dark:bg-night">
              <div className="label">{label}</div>
              <div className="font-serif text-2xl font-bold tabular-nums">{now}</div>
              <div className="text-xs text-ink-muted">default: {was}</div>
            </div>
          ))}
        </div>
        <button className="btn mt-3" onClick={() => dispatch({ type: 'setApproach', patch: { pilotFirst: def.pilotFirst, humanReview: def.humanReview, sharedDataLayer: def.sharedDataLayer } })}>
          ↺ Reset pilot, review and data-layer switches
        </button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Build vs buy" subtitle="Per use case.">
          <div className="space-y-2">
            {USE_CASES.map((u) => {
              const r = result.useCases.find((x) => x.id === u.id)!;
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 last:border-0 dark:border-night-line">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">#{u.number} {u.short} {!state.funded[u.id] && <span className="text-xs text-ink-muted">(deferred)</span>}</div>
                    <div className="text-xs text-ink-muted">Year-0 {fmtM(r.year0, 2)} · opex {fmtM(r.components.operatingCost, 2)} · Year-1 value {fmtPct(r.yearShares[0])}</div>
                  </div>
                  <Segmented
                    label={`${u.short} sourcing`}
                    value={a.sourcing[u.id]}
                    onChange={(v) => dispatch({ type: 'setSourcing', id: u.id, value: v })}
                    options={[{ value: 'build', label: 'Build' }, { value: 'buy', label: 'Buy' }]}
                  />
                </div>
              );
            })}
          </div>
          <Effect>
            <strong>Buy</strong> = Year-0 × {buy.year0Mult} (−{fmtPct(1 - buy.year0Mult)}), operating cost × {buy.opexMult} (+{fmtPct(buy.opexMult - 1)} vendor fees),
            and +{fmtPct(buy.rampBoost)} points of Year-1 adoption (capped at 100%). The ramp boost only shows when the adoption ramp on the Scenarios tab is below 100%.
          </Effect>
        </Card>

        <div className="space-y-4">
          <Card title="Pilot order" subtitle="Which use case runs the first 90-day pilot.">
            <Segmented
              label="Pilot first"
              value={a.pilotFirst}
              onChange={(v) => dispatch({ type: 'setApproach', patch: { pilotFirst: v } })}
              options={[{ value: 'disputes', label: 'Disputes first (team plan)' }, { value: 'fraud', label: 'Fraud first' }]}
            />
            <div className="mt-2"><Delta now={t.npv} before={npvWith(state, { pilotFirst: 'disputes' }).npv} /></div>
            <Effect>
              The pilot-first use case reaches the full adoption ramp in Year 1; every later use case lags and reaches ramp² (e.g. 70% → 49%).
              Rollout order now: <strong>{order.map((id) => getUseCase(id).short).join(' → ')}</strong>.
              Fraud first brings more value forward but scores lower on speed (3 vs 4) and carries real-time risk, which is why the team pilots Disputes.
              With a 100% ramp, order has no NPV effect.
            </Effect>
          </Card>

          <Card title="Human-review level" subtitle="How much AI output a person checks before it takes effect.">
            <Segmented<HumanReview>
              label="Human review"
              value={a.humanReview}
              onChange={(v) => dispatch({ type: 'setApproach', patch: { humanReview: v } })}
              options={[{ value: 'all', label: 'Every case reviewed' }, { value: 'sampled', label: 'Sampled' }, { value: 'auto', label: 'Auto-route low-risk' }]}
            />
            <div className="mt-2"><Delta now={t.npv} before={npvWith(state, { humanReview: 'all' }).npv} /></div>
            <Effect>
              {(['all', 'sampled', 'auto'] as HumanReview[]).map((k) => {
                const e = APPROACH_EFFECTS.review[k];
                return (
                  <span key={k} className={`block ${a.humanReview === k ? 'font-semibold' : ''}`}>
                    {k === 'all' ? 'Every case reviewed' : k === 'sampled' ? 'Sampled' : 'Auto-route low-risk'}: operating cost × {e.opexMult}, residual risk × {e.riskMult}
                    {k === 'all' ? ' (the workbook’s assumption)' : ''}
                  </span>
                );
              })}
              <span className="mt-1 block text-xs text-ink-muted">Regulators expect human approval for Reg E denials and SAR decisions; lighter review raises model-risk exposure.</span>
            </Effect>
          </Card>

          <Card title="Shared data layer">
            <Toggle
              checked={a.sharedDataLayer}
              onChange={(v) => dispatch({ type: 'setApproach', patch: { sharedDataLayer: v } })}
              label="Build one shared risk-data layer"
              description="Funded from the Data & cloud budget line."
            />
            <div className="mt-2"><Delta now={t.npv} before={npvWith(state, { sharedDataLayer: false }).npv} /></div>
            <Effect>
              On = every use case after the pilot-first one needs {fmtPct(APPROACH_EFFECTS.sharedDataDiscount)} less integration and data work (Year-0 lines I1 + I2;
              for lump-sum use cases we assume half of Year-0 is integration and data).
            </Effect>
          </Card>
        </div>
      </div>
    </div>
  );
}
