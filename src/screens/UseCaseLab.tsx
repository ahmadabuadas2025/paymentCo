// Screen 2 — Use-case lab: every driver for one use case, with a live mini-waterfall.
import { useState } from 'react';
import { Waterfall } from '../components/charts';
import { Card, ChartCard, DriverControl, Segmented } from '../components/ui';
import { fmtM, fmtMonths, fmtPct } from '../lib/format';
import { GROUP_LABELS, USE_CASES, getUseCase } from '../model/useCases';
import type { DriverGroup, UseCaseId } from '../model/types';
import { useScenario } from '../state/ScenarioContext';

const GROUP_ORDER: DriverGroup[] = ['savings', 'loss', 'revenue', 'wc', 'opex', 'risk', 'year0'];

const FORMULAS: Partial<Record<UseCaseId, Partial<Record<DriverGroup, string>>>> = {
  disputes: {
    savings: 'D1·D2·D3·D4 + D5·D6·D7·D8',
    loss: 'D1·L1·L3·L4',
    revenue: 'R1·R2',
    wc: '(D1·L1)·W1·(W2−W3)/365·r',
    opex: 'O1·(D1·D3 + D5·D7) + O3 + O4·O5',
    risk: '(D1·D3 + D5·D7)·X1·X2 + X3',
    year0: 'I1 + I2 + I3 + I4 + I5',
  },
  fincrime: {
    savings: 'F1·F2·F3·F4 + F5·F6·F7·F8 + F9·F10·F11·F12',
    loss: 'L1·L2·L3',
    opex: 'O1 + O2 + O3·O4',
    risk: 'X1·X2·X3 + X4',
    year0: 'I1 + I2 + I3 + I4 + I5',
  },
};

const LINE_KEY: Record<DriverGroup, keyof import('../model/types').ValueComponents> = {
  savings: 'costSavings',
  loss: 'lossAvoidance',
  revenue: 'revenue',
  wc: 'workingCapital',
  opex: 'operatingCost',
  risk: 'residualRisk',
  year0: 'year0',
};

export default function UseCaseLab() {
  const { state, result, dispatch } = useScenario();
  const [id, setId] = useState<UseCaseId>('disputes');
  const u = getUseCase(id);
  const r = result.useCases.find((x) => x.id === id)!;
  const drivers = state.drivers[id];
  const changedCount = u.drivers.filter((d) => drivers[d.id] !== d.value).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Use case"
          value={id}
          onChange={setId}
          options={USE_CASES.map((x) => ({ value: x.id, label: `#${x.number} ${x.short}${state.funded[x.id] ? '' : ' (deferred)'}` }))}
        />
        <div className="flex items-center gap-2">
          {changedCount > 0 && <span className="text-sm font-medium text-gold-600 dark:text-gold">{changedCount} input{changedCount > 1 ? 's' : ''} changed</span>}
          <button className="btn" disabled={changedCount === 0} onClick={() => dispatch({ type: 'resetUseCase', id })}>↺ Reset all {u.short} inputs</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 md:grid-cols-2">
          {GROUP_ORDER.map((g) => {
            const defs = u.drivers.filter((d) => d.group === g);
            if (defs.length === 0) return null;
            const formula = FORMULAS[id]?.[g];
            const subtracts = g === 'opex' || g === 'risk';
            return (
              <Card
                key={g}
                title={<span className="flex items-baseline justify-between gap-2"><span>{GROUP_LABELS[g]}</span><span className="font-sans text-base tabular-nums">{subtracts ? '−' : ''}{fmtM(r.components[LINE_KEY[g]], 2)}</span></span>}
                subtitle={formula ? <code className="text-xs">{formula}</code> : undefined}
              >
                <div className="space-y-1">
                  {defs.map((d) => (
                    <DriverControl
                      key={d.id}
                      def={d}
                      value={drivers[d.id]}
                      onChange={(value) => dispatch({ type: 'setDriver', id, key: d.id, value })}
                      onReset={() => dispatch({ type: 'resetDriver', id, key: d.id })}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <ChartCard title={`#${u.number} ${u.name}`} subtitle={u.description}>
            <Waterfall components={r.components} height={240} compact />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Net annual value" value={fmtM(r.net, 2)} />
              <Stat label="Year-0 investment" value={fmtM(r.year0, 2)} />
              <Stat label="3-yr NPV" value={fmtM(r.npv, 2)} good={r.npv > 0} />
              <Stat label="Payback" value={fmtMonths(r.payback)} />
              <Stat label={`Risk-adj NPV (haircut ${fmtPct(r.haircut)})`} value={fmtM(r.riskAdjNpv, 2)} good={r.riskAdjNpv > 0} />
              <Stat label="Risk-adj ROI" value={fmtPct(r.riskAdjRoi)} />
              <Stat label="Downside NPV" value={fmtM(r.downsideNpv, 2)} good={r.downsideNpv > 0} />
              <Stat label="Upside NPV" value={fmtM(r.upsideNpv, 2)} />
            </dl>
            {!state.funded[id] && (
              <p className="mt-3 rounded-lg bg-cream p-2 text-xs dark:bg-night">
                This use case is <strong>deferred</strong>, so it is not in the portfolio totals. Fund it on the Portfolio builder tab.
              </p>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted dark:text-[#9AA39E]">{label}</dt>
      <dd className={`font-semibold tabular-nums ${good === false ? 'text-stop dark:text-stop-dark' : ''}`}>
        {value}
        {good === false && <span className="ml-1 text-xs">(negative)</span>}
      </dd>
    </div>
  );
}
