// Screen 3 — Portfolio builder: fund or defer use cases, budget fit, bubble and radar charts.
import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  LabelList,
} from 'recharts';
import { AXIS, UC_COLOR, legendText } from '../components/charts';
import { Card, ChartCard, MoneyInput, StatusPill, Toggle } from '../components/ui';
import { fmtM, fmtMonths, tickM } from '../lib/format';
import { BUDGET_TOTAL } from '../model/budget';
import { CRITERIA, scoreAverage } from '../model/scorecard';
import { USE_CASES, getUseCase } from '../model/useCases';
import type { UseCaseId } from '../model/types';
import { useScenario } from '../state/ScenarioContext';

const PAYBACK_CAP = 48; // months; "never pays back" is plotted at the cap

export default function PortfolioBuilder() {
  const { state, result, dispatch } = useScenario();
  const deferredIds = USE_CASES.filter((u) => !u.defaultFunded).map((u) => u.id);
  const [compare, setCompare] = useState<UseCaseId>('contact');
  const t = result.totals;
  const reserve = BUDGET_TOTAL - t.year0;
  const usedPct = Math.min(100, (t.year0 / BUDGET_TOTAL) * 100);

  const bubbles = result.useCases.map((r) => ({
    id: r.id,
    name: getUseCase(r.id).short,
    x: Math.min(PAYBACK_CAP, r.payback),
    y: r.npv,
    z: r.year0,
    funded: r.funded,
  }));
  const funded = bubbles.filter((b) => b.funded);
  const deferred = bubbles.filter((b) => !b.funded);

  const radarIds: UseCaseId[] = ['fraud', 'disputes', 'fincrime', compare];
  const radarData = CRITERIA.map((c, i) => Object.fromEntries([['criterion', c], ...radarIds.map((id) => [id, getUseCase(id).scores[i]])]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Fund or defer" subtitle="Switch use cases in or out of the portfolio. Deferred use cases use lump-sum placeholders you can edit below or in the Use-case lab.">
          <div className="grid gap-2 sm:grid-cols-2">
            {result.useCases.map((r) => {
              const u = getUseCase(r.id);
              return (
                <motion.div
                  layout
                  key={r.id}
                  className={`rounded-lg border p-3 transition ${r.funded ? 'border-brand/30 bg-brand-100/50 dark:border-[#2BA675]/40 dark:bg-[#2BA675]/10' : 'border-black/10 dark:border-night-line'}`}
                >
                  <Toggle
                    checked={r.funded}
                    onChange={(v) => dispatch({ type: 'setFunded', id: r.id, value: v })}
                    label={<>#{u.number} {u.name} <span className="ml-1 text-xs font-semibold">{r.funded ? '· FUNDED' : '· deferred'}</span></>}
                    description={`NPV ${fmtM(r.npv, 2)} · payback ${fmtMonths(r.payback)} · Year-0 ${fmtM(r.year0, 2)} · score ${scoreAverage(u.scores).toFixed(2)}`}
                  />
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card title="Fit inside the $15M">
          <div className="mb-1 flex justify-between text-sm">
            <span>Year-0 investment</span>
            <strong className="tabular-nums">{fmtM(t.year0, 2)}</strong>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-cream-200 dark:bg-night-line" role="img" aria-label={`${usedPct.toFixed(0)}% of the $15M budget used by Year-0 builds`}>
            <motion.div className={`h-full ${reserve >= 0 ? 'bg-brand dark:bg-[#2BA675]' : 'bg-stop'}`} initial={false} animate={{ width: `${usedPct}%` }} transition={{ duration: 0.5 }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>$0</span>
            <span>$15.0M</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Remaining reserve (scale-up, run costs)" value={fmtM(reserve, 2)} />
            <Row label="Portfolio NPV" value={fmtM(t.npv, 2)} />
            <Row label="Portfolio payback" value={fmtMonths(t.payback)} />
            <Row label="Downside NPV" value={fmtM(t.downsideNpv, 2)} />
          </dl>
          <div className="mt-4">
            <StatusPill ok={reserve >= 0} okText="Within budget" badText="Over budget" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Payback vs NPV" subtitle={`Bubble size = Year-0 investment. Filled = funded, outlined = deferred. Payback beyond ${PAYBACK_CAP} months plotted at the edge.`}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis type="number" dataKey="x" name="Payback" unit=" mo" {...AXIS} domain={[0, 'auto']} label={{ value: 'Payback (months) → slower', position: 'insideBottom', offset: -14, fill: 'var(--axis)', fontSize: 12 }} />
                <YAxis type="number" dataKey="y" name="NPV" {...AXIS} tickFormatter={tickM} width={60} label={{ value: '3-yr NPV', angle: -90, position: 'insideLeft', fill: 'var(--axis)', fontSize: 12 }} />
                <ZAxis type="number" dataKey="z" range={[120, 1400]} name="Year-0" />
                <ReferenceLine y={0} stroke="var(--axis)" strokeDasharray="4 4" />
                <ReferenceLine x={12} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: '12-mo payback', fill: 'var(--axis)', fontSize: 11, position: 'insideTopRight' }} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v: number, n: string) => (n === 'Payback' ? fmtMonths(v) : fmtM(v, 2))}
                  labelFormatter={() => ''}
                />
                <Scatter name="Funded" data={funded} fill="var(--c1)" fillOpacity={0.75} stroke="var(--surface)" strokeWidth={2} animationDuration={500}>
                  <LabelList dataKey="name" position="top" style={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 600 }} />
                </Scatter>
                <Scatter name="Deferred" data={deferred} fill="var(--muted-mark)" fillOpacity={0.25} stroke="var(--muted-mark)" strokeWidth={2} animationDuration={500}>
                  <LabelList dataKey="name" position="top" style={{ fill: 'var(--axis)', fontSize: 11 }} />
                </Scatter>
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} formatter={legendText} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Scorecard profiles"
          subtitle="Our three picks against one deferred use case (1–5; Risk: 5 = lowest exposure)."
          actions={
            <select className="num-input !w-auto !text-left" aria-label="Compare with" value={compare} onChange={(e) => setCompare(e.target.value as UseCaseId)}>
              {deferredIds.map((id) => <option key={id} value={id}>vs {getUseCase(id).short}</option>)}
            </select>
          }
        >
          <div className="h-[340px]">
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="var(--grid)" />
                <PolarAngleAxis dataKey="criterion" tick={{ fill: 'var(--axis)', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
                {radarIds.map((id, i) => (
                  <Radar
                    key={id}
                    name={`${getUseCase(id).short} (${scoreAverage(getUseCase(id).scores).toFixed(2)})`}
                    dataKey={id}
                    stroke={i < 3 ? UC_COLOR[id] : 'var(--c4)'}
                    fill={i < 3 ? UC_COLOR[id] : 'var(--c4)'}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    strokeDasharray={i === 3 ? '5 4' : undefined}
                    animationDuration={500}
                  />
                ))}
                <Legend formatter={legendText} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card title="Deferred use cases: lump-sum inputs" subtitle="Team placeholders (not in the workbook). Overwrite them with your classmates' estimates.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left">
                <th className="label py-1">Use case</th>
                {['CS', 'LA', 'REV', 'WC', 'OP', 'RISK', 'Y0'].map((k) => (
                  <th key={k} className="label py-1 text-right">{getUseCase('contact').drivers.find((d) => d.id === k)!.label.replace('Expected residual risk cost', 'Residual risk').replace('Working-capital benefit', 'Working cap.')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deferredIds.map((id) => (
                <tr key={id} className="border-t border-black/5 dark:border-night-line">
                  <td className="py-1.5 pr-2 font-medium">{getUseCase(id).short}</td>
                  {['CS', 'LA', 'REV', 'WC', 'OP', 'RISK', 'Y0'].map((k) => (
                    <td key={k} className="px-1 py-1.5">
                      <MoneyInput value={state.drivers[id][k]} onChange={(v) => dispatch({ type: 'setDriver', id, key: k, value: v })} label={`${getUseCase(id).short} ${k}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
