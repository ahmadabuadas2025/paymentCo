// Small reusable UI pieces: cards, tooltips, count-up numbers, toggles and driver inputs.
import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { exportPng } from '../lib/export';
import { fmtDriver } from '../lib/format';
import type { DriverDef } from '../model/types';
import { useScenario } from '../state/ScenarioContext';

export function Card({ title, subtitle, actions, children, className = '' }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-lg font-semibold leading-tight">{title}</h3>}
            {subtitle && <p className="muted mt-0.5 text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A card with a "PNG" button that exports whatever is inside it. */
export function ChartCard({ title, subtitle, children, className = '', actions }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { presenting } = useScenario();
  return (
    <div ref={ref} className={className}>
      <Card
        title={title}
        subtitle={subtitle}
        className="h-full"
        actions={
          <>
            {actions}
            {!presenting && (
              <button className="btn !px-2 !py-1 text-xs" onClick={() => ref.current && exportPng(ref.current, title)} aria-label={`Download ${title} as PNG`}>
                ⤓ PNG
              </button>
            )}
          </>
        }
      >
        {children}
      </Card>
    </div>
  );
}

/** "i" bubble that shows a tooltip on hover or keyboard focus. */
export function InfoTip({ text, label = 'More info' }: { text: ReactNode; label?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none text-ink-muted dark:text-[#9AA39E]"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100 dark:bg-[#E8ECE9] dark:text-night"
      >
        {text}
      </span>
    </span>
  );
}

/** Number that counts up/down to its new value (instant when reduced motion is on). */
export function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduce || !Number.isFinite(value) || !Number.isFinite(prev.current)) {
      setShown(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (v) => setShown(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

export type Tone = 'good' | 'bad' | 'neutral';

const toneClass: Record<Tone, string> = {
  good: 'text-ok dark:text-ok-dark',
  bad: 'text-stop dark:text-stop-dark',
  neutral: 'text-ink-soft dark:text-[#AEB7B2]',
};

export function KpiTile({ label, value, format, note, tone = 'neutral', toneLabel, info, big = false }: {
  label: string;
  value: number;
  format: (v: number) => string;
  note?: ReactNode;
  tone?: Tone;
  toneLabel?: string;
  info?: string;
  big?: boolean;
}) {
  return (
    <motion.div layout className="card flex min-w-0 flex-col justify-between">
      <div className="label flex items-center">
        {label}
        {info && <InfoTip text={info} label={`About ${label}`} />}
      </div>
      <div className={`mt-2 font-serif font-bold leading-none text-brand dark:text-[#E8ECE9] ${big ? 'text-[clamp(2rem,3.4vw,3.75rem)]' : 'text-[clamp(1.6rem,2.3vw,2.25rem)]'}`}>
        <AnimatedNumber value={value} format={format} />
      </div>
      {(note || toneLabel) && (
        <div className={`mt-2 text-sm ${big ? 'text-base' : ''}`}>
          {toneLabel && <span className={`mr-1 font-semibold ${toneClass[tone]}`}>{tone === 'good' ? '▲' : tone === 'bad' ? '▼' : '•'} {toneLabel}</span>}
          {note && <span className="muted">{note}</span>}
        </div>
      )}
    </motion.div>
  );
}

/** Pill showing a status with an icon and a word, so meaning never relies on colour alone. */
export function StatusPill({ ok, okText = 'On target', badText = 'Stop' }: { ok: boolean; okText?: string; badText?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        ok ? 'bg-ok-light text-ok dark:bg-ok/20 dark:text-ok-dark' : 'bg-stop-light text-stop dark:bg-stop/20 dark:text-stop-dark'
      }`}
    >
      {ok ? '✓' : '✕'} {ok ? okText : badText}
    </span>
  );
}

/** Segmented control (radio group). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-black/10 bg-cream-200 p-0.5 dark:border-night-line dark:bg-night">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            value === o.value ? 'bg-white text-brand shadow-sm dark:bg-night-card dark:text-[#E8ECE9]' : 'text-ink-soft hover:text-ink dark:text-[#9AA39E] dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand dark:bg-[#2BA675]' : 'bg-black/20 dark:bg-white/20'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
      <span>
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="muted block text-xs">{description}</span>}
      </span>
    </label>
  );
}

/** Slider + number input for one numeric value. Percent values are edited as whole percents. */
export function SliderInput({ value, min, max, step, onChange, pct = false, ariaLabel }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  pct?: boolean;
  ariaLabel: string;
}) {
  const scale = pct ? 100 : 1;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(+(value * scale).toFixed(pct ? 2 : 4));
  const commit = (s: string) => {
    const n = Number(s.replace(/[,$%\s]/g, ''));
    if (Number.isFinite(n)) onChange(n / scale);
    setDraft(null);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-label={ariaLabel}
        className="min-w-0 flex-1"
        min={min}
        max={Math.max(max, value)}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="relative w-28 shrink-0">
        <input
          className="num-input pr-6"
          inputMode="decimal"
          aria-label={`${ariaLabel} value`}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{pct ? '%' : ''}</span>
      </div>
    </div>
  );
}

/** One driver row: label, source tooltip, changed highlight, slider/number and reset. */
export function DriverControl({ def, value, onChange, onReset }: {
  def: DriverDef;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const changed = value !== def.value;
  return (
    <div className={`rounded-lg px-2 py-1.5 transition ${changed ? 'bg-gold/15 ring-1 ring-gold/60' : ''}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center">
          <span className="mr-1.5 font-mono text-xs text-ink-muted">{def.id}</span>
          <span className="truncate">{def.label}</span>
          <InfoTip label={`Source for ${def.label}`} text={<><strong>Source:</strong> {def.source}<br />Default: {fmtDriver(def.value, def.unit)}</>} />
        </span>
        {changed && (
          <button className="shrink-0 text-xs font-medium text-gold-600 underline-offset-2 hover:underline dark:text-gold" onClick={onReset} aria-label={`Reset ${def.label}`}>
            ↺ reset
          </button>
        )}
      </div>
      <SliderInput
        ariaLabel={def.label}
        value={value}
        min={def.min}
        max={def.max}
        step={def.step}
        pct={def.unit === 'pct'}
        onChange={(v) => onChange(def.isShare ? Math.min(1, Math.max(0, v)) : Math.max(0, v))}
      />
    </div>
  );
}

/** Dollar input edited in $M (e.g. 2.2 = $2.2M). */
export function MoneyInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (s: string) => {
    const n = Number(s.replace(/[$,M\s]/gi, ''));
    if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 1_000_000));
    setDraft(null);
  };
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">$</span>
      <input
        className="num-input pl-4 pr-5"
        inputMode="decimal"
        aria-label={`${label} in millions`}
        value={draft ?? (value / 1_000_000).toFixed(2)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">M</span>
    </div>
  );
}
