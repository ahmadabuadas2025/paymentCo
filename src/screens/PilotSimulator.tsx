// Screen 6 — 90-day Disputes pilot: animated case flow, live metrics, gates and stop rules.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS } from '../components/charts';
import { Card, ChartCard, Segmented, SliderInput } from '../components/ui';
import { fmtPct } from '../lib/format';
import { DEFAULT_PILOT, GATES, PILOT_TARGETS, simulatePilot, type PilotParams, type PilotRun } from '../model/pilot';

// ---- Flow diagram geometry ----
type Tag = 'Automate' | 'Augment' | 'Escalate' | 'Humans only';
const TAG_COLOR: Record<Tag, string> = { Automate: 'var(--c3)', Augment: 'var(--c1)', Escalate: 'var(--c2)', 'Humans only': 'var(--c4)' };
const STAGES: { name: string; tag: Tag }[] = [
  { name: 'Intake', tag: 'Automate' },
  { name: 'Extract', tag: 'Automate' },
  { name: 'Rules', tag: 'Automate' },
  { name: 'Recommend', tag: 'Augment' },
  { name: 'Analyst review', tag: 'Augment' },
  { name: 'Representment', tag: 'Humans only' },
];
const W = 960;
const MAIN_Y = 92;
const SPEC_Y = 214;
const stageX = (i: number) => 70 + i * 164;
const ESCALATE_AT = 2; // dots peel off after the Rules step

interface Dot {
  id: number;
  p: number; // progress 0..STAGES.length-1 along the main lane (or to the specialist box)
  ai: boolean;
  escalated: boolean;
}

const DAYS_PER_SECOND = 2; // at 1× speed the 90 days take 45 seconds

export default function PilotSimulator() {
  const reduce = useReducedMotion();
  const [params, setParams] = useState<PilotParams>(DEFAULT_PILOT);
  const run: PilotRun = useMemo(() => simulatePilot(params), [params]);
  const [day, setDay] = useState(0); // fractional day for smooth animation
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<'1' | '2' | '4' | '8'>('2');
  const [dots, setDots] = useState<Dot[]>([]);
  const nextId = useRef(0);
  const spawnAcc = useRef(0);
  // Refs let the animation loop read the latest run and day without restarting every frame.
  const runRef = useRef(run);
  runRef.current = run;
  const dayRef = useRef(day);
  dayRef.current = day;

  const d = Math.min(90, Math.max(1, Math.floor(day) || 1));
  const today = run.days[d - 1];
  const stopped = run.stop && day >= run.stop.day ? run.stop : null;

  // Animation loop: advances the day and moves the dots.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const mult = Number(speed);
      setDay((prev) => {
        const next = prev + dt * DAYS_PER_SECOND * mult;
        if (next >= 90) {
          setPlaying(false);
          return 90;
        }
        return next;
      });
      if (!reduce) {
        const cur = runRef.current.days[Math.min(89, Math.max(0, Math.floor(dayRef.current)))];
        // Spawn rate follows daily volume; dot speed follows cycle time (slower when queues build).
        spawnAcc.current += dt * (cur.volume / 60) * Math.min(mult, 3);
        const moveRate = dt * Math.min(mult, 3) * (3.2 / Math.max(1.2, cur.cycleTime));
        // Decide new dots outside the state updater (StrictMode may run updaters twice).
        const born: Dot[] = [];
        while (spawnAcc.current >= 1) {
          spawnAcc.current -= 1;
          born.push({ id: nextId.current++, p: 0, ai: Math.random() < cur.aiShare, escalated: Math.random() < cur.escalatedShare });
        }
        setDots((prev) => {
          const out: Dot[] = [];
          for (const dot of prev) {
            const p = dot.p + moveRate * (dot.escalated && dot.p >= ESCALATE_AT ? 0.6 : 1);
            const end = dot.escalated ? ESCALATE_AT + 2 : STAGES.length - 1;
            if (p < end + 0.4) out.push({ ...dot, p });
          }
          return [...out, ...born].slice(-70);
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, reduce]);

  const reset = () => {
    setPlaying(false);
    setDay(0);
    setDots([]);
  };

  const shown = run.days.slice(0, Math.floor(day));
  const set = (k: keyof PilotParams) => (v: number) => setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stopped ? 'stop' : 'go'}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold ${
            stopped ? 'bg-stop text-white' : 'bg-ok-light text-ok dark:bg-ok/20 dark:text-ok-dark'
          }`}
        >
          <span className="text-lg">
            {stopped ? `⛔ STOP: ${stopped.message}` : day === 0 ? '▶ Ready: press Play to run the 90-day Disputes pilot' : `✓ Continue: Day ${d} of 90, all stop rules clear`}
          </span>
          <span className="text-sm font-normal">Stop if rework rises, overrides leave 2–25%, or a Reg E deadline is missed.</span>
        </motion.div>
      </AnimatePresence>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ChartCard
          title="Dispute flow"
          subtitle="Each dot is a dispute. Filled dots got AI assistance; hollow dots were handled manually. Escalated dots peel off to the specialist lane."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={() => (day >= 90 ? (reset(), setPlaying(true)) : setPlaying(!playing))}>
                {playing ? '❚❚ Pause' : day >= 90 ? '↻ Replay' : '▶ Play'}
              </button>
              <button className="btn" onClick={reset}>⏮ Reset</button>
              <button className="btn" onClick={() => { setPlaying(false); setDay(90); }}>⏭ Day 90</button>
              <Segmented label="Speed" value={speed} onChange={setSpeed} options={(['1', '2', '4', '8'] as const).map((s) => ({ value: s, label: `${s}×` }))} />
            </div>
          }
        >
          <svg viewBox={`0 0 ${W} 282`} className="w-full" role="img" aria-label={`Dispute flow on day ${d}: ${fmtPct(today.aiShare)} AI-assisted, ${fmtPct(today.escalatedShare)} escalated`}>
            {/* lanes */}
            <line x1={stageX(0)} y1={MAIN_Y} x2={stageX(STAGES.length - 1)} y2={MAIN_Y} stroke="var(--grid)" strokeWidth={10} strokeLinecap="round" />
            <path d={`M ${stageX(ESCALATE_AT)} ${MAIN_Y} C ${stageX(ESCALATE_AT) + 60} ${MAIN_Y + 70}, ${stageX(ESCALATE_AT) + 80} ${SPEC_Y}, ${stageX(ESCALATE_AT + 1)} ${SPEC_Y} L ${stageX(ESCALATE_AT + 2)} ${SPEC_Y}`} fill="none" stroke="var(--grid)" strokeWidth={8} strokeLinecap="round" />
            {STAGES.map((s, i) => (
              <g key={s.name} transform={`translate(${stageX(i)}, ${MAIN_Y})`}>
                <rect x={-58} y={-62} width={116} height={24} rx={12} fill={TAG_COLOR[s.tag]} opacity={0.16} />
                <text y={-45} textAnchor="middle" fontSize={11} fontWeight={700} fill={TAG_COLOR[s.tag]}>{s.tag.toUpperCase()}</text>
                <circle r={16} fill="var(--surface)" stroke={TAG_COLOR[s.tag]} strokeWidth={3} />
                <text y={5} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)">{i + 1}</text>
                <text y={38} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">{s.name}</text>
              </g>
            ))}
            <g transform={`translate(${stageX(ESCALATE_AT + 2)}, ${SPEC_Y})`}>
              <rect x={-70} y={-20} width={140} height={40} rx={10} fill="var(--surface)" stroke={TAG_COLOR.Escalate} strokeWidth={2.5} />
              <text y={-1} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)">Specialist</text>
              <text y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TAG_COLOR.Escalate}>ESCALATE</text>
            </g>
            <text x={stageX(ESCALATE_AT + 2)} y={SPEC_Y + 38} textAnchor="middle" fontSize={12} fill="var(--axis)">fraud rings, legal, high value</text>
            {/* dots */}
            {!reduce &&
              dots.map((dot) => {
                const pos = dotPosition(dot);
                return (
                  <circle
                    key={dot.id}
                    cx={pos.x}
                    cy={pos.y}
                    r={6}
                    fill={dot.ai ? 'var(--c1)' : 'var(--surface)'}
                    stroke={dot.escalated && dot.p >= ESCALATE_AT ? 'var(--c2)' : 'var(--c1)'}
                    strokeWidth={2}
                  />
                );
              })}
            {reduce && (
              <text x={W / 2} y={274} textAnchor="middle" fontSize={12} fill="var(--axis)">
                Reduced motion: dots hidden. Day {d}: {fmtPct(today.aiShare)} AI-assisted, {fmtPct(today.escalatedShare)} escalated.
              </text>
            )}
          </svg>
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <span className="label w-16">Day {Math.floor(day)}</span>
              <input
                type="range"
                className="flex-1"
                aria-label="Pilot day"
                min={0}
                max={90}
                step={1}
                value={Math.floor(day)}
                onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)); }}
              />
            </div>
            <div className="relative ml-[76px] mr-1 h-6">
              {run.gates.map((g) => {
                const reached = day >= g.day;
                return (
                  <span
                    key={g.day}
                    className={`absolute ${g.day === 90 ? '-translate-x-full' : '-translate-x-1/2'} whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                      !reached ? 'bg-cream-200 text-ink-muted dark:bg-night-line' : g.pass ? 'bg-ok-light text-ok dark:bg-ok/20 dark:text-ok-dark' : 'bg-stop-light text-stop dark:bg-stop/20 dark:text-stop-dark'
                    }`}
                    style={{ left: `${(g.day / 90) * 100}%` }}
                  >
                    {!reached ? '○' : g.pass ? '✓' : '✕'} Day {g.day}
                  </span>
                );
              })}
            </div>
          </div>
        </ChartCard>

        <div className="space-y-4">
          <Card title="Pilot settings">
            <div className="space-y-3 text-sm">
              <Setting label="Daily dispute volume"><SliderInput ariaLabel="Daily volume" value={params.dailyVolume} min={100} max={600} step={10} onChange={set('dailyVolume')} /></Setting>
              <Setting label="AI confidence threshold"><SliderInput ariaLabel="Confidence threshold" value={params.confidenceThreshold} min={0.5} max={0.99} step={0.01} pct onChange={set('confidenceThreshold')} /></Setting>
              <Setting label="Analysts"><SliderInput ariaLabel="Analysts" value={params.analysts} min={4} max={30} step={1} onChange={set('analysts')} /></Setting>
              <Setting label="Analyst override tendency"><SliderInput ariaLabel="Override rate" value={params.overrideRate} min={0} max={0.5} step={0.01} pct onChange={set('overrideRate')} /></Setting>
              <button className="btn" onClick={() => setParams(DEFAULT_PILOT)}>↺ Default settings</button>
            </div>
          </Card>
          <Card title={`Today: Day ${d}`}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Now label="Cycle time" value={`${today.cycleTime.toFixed(1)} d`} ok={today.cycleTime <= PILOT_TARGETS.targetCycle} />
              <Now label="Rework" value={fmtPct(today.rework, 1)} ok={today.rework < PILOT_TARGETS.targetRework} />
              <Now label="Override rate" value={fmtPct(today.overrideRate, 1)} ok={today.overrideRate >= PILOT_TARGETS.overrideLow && today.overrideRate <= PILOT_TARGETS.overrideHigh} />
              <Now label="Reg E misses" value={String(today.regEMisses)} ok={today.regEMisses === 0} />
              <Now label="AI-assisted" value={fmtPct(today.aiShare)} />
              <Now label="Analyst load" value={fmtPct(today.utilization)} ok={today.utilization <= 0.9} />
            </dl>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricChart title="Cycle time (days)" subtitle="Baseline 5.2 days → target 2" data={shown} dataKey="cycleTime" color="var(--c3)" domain={[0, 8]} format={(v) => `${v.toFixed(1)} d`} gates={run} day={day}
          refs={[{ y: PILOT_TARGETS.baselineCycle, label: 'Baseline 5.2' }, { y: PILOT_TARGETS.targetCycle, label: 'Target 2.0' }]} />
        <MetricChart title="Rework rate" subtitle="Baseline 18% → target under 8%" data={shown} dataKey="rework" color="var(--c4)" domain={[0, 0.25]} format={(v) => fmtPct(v, 1)} gates={run} day={day}
          refs={[{ y: PILOT_TARGETS.baselineRework, label: 'Baseline 18%' }, { y: PILOT_TARGETS.targetRework, label: 'Target 8%' }]} />
        <MetricChart title="Analyst override rate" subtitle="Shaded band = 2–25% safe zone" data={shown} dataKey="overrideRate" color="var(--c1)" domain={[0, 0.4]} format={(v) => fmtPct(v, 1)} gates={run} day={day}
          band={[PILOT_TARGETS.overrideLow, PILOT_TARGETS.overrideHigh]} />
      </div>

      <Card title="Gates: what releases the next tranche of funding">
        <div className="grid gap-3 md:grid-cols-3">
          {run.gates.map((g, i) => {
            const reached = day >= g.day;
            const spec = GATES[i];
            return (
              <div key={g.day} className={`rounded-lg border-2 p-3 ${!reached ? 'border-dashed border-black/10 dark:border-night-line' : g.pass ? 'border-ok dark:border-ok-dark' : 'border-stop dark:border-stop-dark'}`}>
                <div className="flex items-center justify-between">
                  <strong>{g.label}</strong>
                  <span className={`text-sm font-bold ${!reached ? 'text-ink-muted' : g.pass ? 'text-ok dark:text-ok-dark' : 'text-stop dark:text-stop-dark'}`}>
                    {!reached ? 'Pending' : g.pass ? '✓ PASS' : '✕ FAIL'}
                  </span>
                </div>
                <p className="muted mt-1 text-xs">Needs cycle time ≤ {spec.maxCycle} days, rework ≤ {fmtPct(spec.maxRework)}, no stop rule fired.</p>
                {reached && !g.pass && <ul className="mt-1 list-disc pl-4 text-xs text-stop dark:text-stop-dark">{g.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Illustrative operations model (not in the workbook): coverage = 1.45 − threshold, so 85% confidence → 60% AI-assisted (driver D3). Learning curve 1 − e^(−day/18). See README for every constant.
        </p>
      </Card>
    </div>
  );
}

/** Where a dot sits on screen for its progress value. */
function dotPosition(dot: Dot): { x: number; y: number } {
  if (!dot.escalated || dot.p <= ESCALATE_AT) {
    const i = Math.min(STAGES.length - 1, dot.p);
    const lo = Math.floor(i);
    const frac = i - lo;
    const x = stageX(lo) + frac * (stageX(Math.min(STAGES.length - 1, lo + 1)) - stageX(lo));
    return { x, y: MAIN_Y + ((dot.id * 7) % 11) - 5 };
  }
  // Escalated: curve down to the specialist lane, then along it.
  const q = Math.min(2, dot.p - ESCALATE_AT);
  const x = stageX(ESCALATE_AT) + q * 164;
  const y = q < 1 ? MAIN_Y + (SPEC_Y - MAIN_Y) * (1 - Math.cos(q * Math.PI)) / 2 : SPEC_Y;
  return { x, y: y + ((dot.id * 5) % 9) - 4 };
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 font-medium">{label}</div>
      {children}
    </div>
  );
}

function Now({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg bg-cream p-2 dark:bg-night">
      <dt className="text-xs text-ink-muted dark:text-[#9AA39E]">{label}</dt>
      <dd className="font-semibold tabular-nums">
        {value}
        {ok !== undefined && (
          <span className={`ml-1 text-xs ${ok ? 'text-ok dark:text-ok-dark' : 'text-stop dark:text-stop-dark'}`}>{ok ? '✓ on target' : '✕ off target'}</span>
        )}
      </dd>
    </div>
  );
}

function MetricChart({ title, subtitle, data, dataKey, color, domain, format, refs = [], band, gates, day }: {
  title: string;
  subtitle: string;
  data: PilotRun['days'];
  dataKey: 'cycleTime' | 'rework' | 'overrideRate';
  color: string;
  domain: [number, number];
  format: (v: number) => string;
  refs?: { y: number; label: string }[];
  band?: [number, number];
  gates: PilotRun;
  day: number;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="h-[200px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="day" type="number" domain={[1, 90]} ticks={[1, 30, 60, 90]} {...AXIS} />
            <YAxis domain={domain} {...AXIS} tickFormatter={format} width={48} allowDataOverflow />
            {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--good)" fillOpacity={0.1} label={{ value: 'safe zone', position: 'insideTopRight', fill: 'var(--axis)', fontSize: 11 }} />}
            {refs.map((r) => (
              <ReferenceLine key={r.label} y={r.y} stroke="var(--axis)" strokeDasharray="4 3" label={{ value: r.label, position: 'insideBottomRight', fill: 'var(--axis)', fontSize: 11 }} />
            ))}
            {gates.gates.map((g) => (
              <ReferenceLine key={g.day} x={g.day} stroke={day < g.day ? 'var(--grid)' : g.pass ? 'var(--good)' : 'var(--bad)'} strokeWidth={2} />
            ))}
            {gates.stop && day >= gates.stop.day && <ReferenceLine x={gates.stop.day} stroke="var(--bad)" strokeDasharray="2 2" label={{ value: 'STOP', fill: 'var(--bad)', fontSize: 11, position: 'insideTopLeft' }} />}
            <Tooltip formatter={(v: number) => [format(v), title]} labelFormatter={(l) => `Day ${l}`} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
