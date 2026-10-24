// Shared charts: value waterfall and downside / base / upside range bar.
import { motion, useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtM, tickM } from '../lib/format';
import type { UseCaseId, ValueComponents } from '../model/types';

/** Colour follows the entity: the team's three picks keep fixed hues; c4 marks the compared/other use case. */
export const UC_COLOR: Record<UseCaseId, string> = {
  fraud: 'var(--c1)',
  disputes: 'var(--c2)',
  fincrime: 'var(--c3)',
  contact: 'var(--c4)',
  growth: 'var(--c4)',
  product: 'var(--c4)',
  finintel: 'var(--c4)',
};

/** Legend labels stay in ink; the swatch beside them carries the series colour. */
export const legendText = (value: string) => <span style={{ color: 'var(--ink)', fontSize: 13 }}>{value}</span>;

export const AXIS = { stroke: 'var(--grid)', tick: { fill: 'var(--axis)', fontSize: 12 } };

interface Step {
  name: string;
  base: number;
  value: number;
  raw: number;
  kind: 'plus' | 'minus' | 'total';
}

/** Build waterfall steps: four value lines up, two cost lines down, then the net total. */
export function waterfallSteps(c: ValueComponents, short = false): Step[] {
  const lines: [string, number][] = [
    [short ? 'Savings' : 'Cost savings', c.costSavings],
    [short ? 'Loss' : 'Loss avoidance', c.lossAvoidance],
    [short ? 'Rev.' : 'Revenue', c.revenue],
    [short ? 'WC' : 'Working capital', c.workingCapital],
    [short ? 'Opex' : 'Operating cost', -c.operatingCost],
    [short ? 'Risk' : 'Residual risk', -c.residualRisk],
  ];
  const steps: Step[] = [];
  let running = 0;
  for (const [name, v] of lines) {
    const next = running + v;
    steps.push({ name, base: Math.min(running, next), value: Math.abs(v), raw: v, kind: v >= 0 ? 'plus' : 'minus' });
    running = next;
  }
  steps.push({ name: short ? 'Net' : 'Net / yr', base: Math.min(0, running), value: Math.abs(running), raw: running, kind: 'total' });
  return steps;
}

const stepColor = (k: Step['kind']) => (k === 'plus' ? 'var(--good)' : k === 'minus' ? 'var(--bad)' : 'var(--brand)');

export function Waterfall({ components, height = 280, compact = false }: { components: ValueComponents; height?: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  const data = waterfallSteps(components, compact);
  return (
    <div style={{ height }} role="img" aria-label={`Waterfall: ${data.map((d) => `${d.name} ${fmtM(d.raw, 2)}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="name" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: compact ? 10 : 12 }} tickLine={false} />
          <YAxis {...AXIS} tickFormatter={tickM} width={56} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', opacity: 0.4 }}
            formatter={(_v, _n, p) => [fmtM((p.payload as Step).raw, 2), (p.payload as Step).kind === 'total' ? 'Net annual value' : 'Change']}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="w" radius={[4, 4, 4, 4]} isAnimationActive={!reduce} animationDuration={500}>
            {data.map((d) => (
              <Cell key={d.name} fill={stepColor(d.kind)} />
            ))}
            {!compact && <LabelList dataKey="raw" position="top" formatter={(v: number) => fmtM(v)} style={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 600 }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal range from downside to upside, with base and risk-adjusted markers. */
export function RangeBar({ down, base, up, riskAdj, big = false }: { down: number; base: number; up: number; riskAdj?: number; big?: boolean }) {
  const reduce = useReducedMotion();
  const lo = Math.min(0, down, riskAdj ?? 0);
  const hi = Math.max(up, base) * 1.08;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const t = { duration: reduce ? 0 : 0.5, ease: 'easeOut' as const };
  const markers = [
    { v: down, label: 'Downside', cls: 'text-stop dark:text-stop-dark' },
    { v: base, label: 'Base', cls: 'text-brand dark:text-[#E8ECE9]' },
    { v: up, label: 'Upside', cls: 'text-ok dark:text-ok-dark' },
  ];
  return (
    <div className={`relative ${big ? 'h-28' : 'h-24'} select-none`} role="img" aria-label={`NPV range: downside ${fmtM(down)}, base ${fmtM(base)}, upside ${fmtM(up)}`}>
      {/* track */}
      <div className="absolute left-0 right-0 top-12 h-3 rounded-full bg-cream-200 dark:bg-night-line" />
      {/* zero line */}
      <div className="absolute top-9 h-9 w-px bg-ink-muted" style={{ left: `${x(0)}%` }}>
        <span className="absolute -left-1 top-0 -translate-x-full text-[11px] text-ink-muted">$0</span>
      </div>
      {/* down -> up band */}
      <motion.div
        className="absolute top-12 h-3 rounded-full"
        style={{ background: 'linear-gradient(90deg, var(--bad), var(--gold) 50%, var(--good))' }}
        initial={false}
        animate={{ left: `${x(down)}%`, width: `${x(up) - x(down)}%` }}
        transition={t}
      />
      {riskAdj !== undefined && (
        <motion.div className="absolute top-10 h-7 w-0.5 -translate-x-1/2 bg-gold" initial={false} animate={{ left: `${x(riskAdj)}%` }} transition={t} />
      )}
      {markers.map((m, i) => {
        // Downside/upside labels sit above the track, base below, so they never collide.
        // Edge labels are anchored inward so they stay inside the card.
        const pos = x(m.v);
        const align = pos < 12 ? 'translate-x-0' : pos > 88 ? '-translate-x-full' : '-translate-x-1/2';
        const isBase = i === 1;
        return (
          <motion.div key={m.label} className="absolute top-0 w-0" initial={false} animate={{ left: `${pos}%` }} transition={t}>
            <div className={`absolute whitespace-nowrap ${align} ${m.cls} ${isBase ? 'top-[76px] font-bold' : 'top-0 font-semibold'} ${big ? 'text-base' : 'text-xs'}`}>
              {m.label} {fmtM(m.v)}
            </div>
            <div className={`absolute top-9 h-9 w-1 -translate-x-1/2 rounded ${isBase ? 'bg-brand dark:bg-white' : 'bg-current'} ${m.cls}`} />
          </motion.div>
        );
      })}
    </div>
  );
}
