// Number formatting used everywhere in the UI.
import type { DriverUnit } from '../model/types';

/** Currency in millions: $X.XM (2 dp below $10M when `precise`). Negative shown as −$X.XM. */
export function fmtM(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}$${(Math.abs(v) / 1_000_000).toFixed(digits)}M`;
}

/** Compact dollars for driver inputs: $95,000 / $0.50 / $1.2M. */
export function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1_000_000) return fmtM(v, 2);
  if (Math.abs(v) < 10 && v % 1 !== 0) return `$${v.toFixed(2)}`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

export function fmtPct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtMonths(v: number): string {
  return Number.isFinite(v) ? `${v.toFixed(1)} mo` : 'never';
}

export function fmtNumber(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** Format a driver value according to its unit. */
export function fmtDriver(v: number, unit: DriverUnit): string {
  switch (unit) {
    case 'usd':
      return fmtUsd(v);
    case 'pct':
      return fmtPct(v, v !== 0 && Math.abs(v) < 0.1 ? 1 : 0);
    case 'days':
      return `${v} days`;
    case 'fte':
      return `${v} FTE`;
    case 'hours':
      return `${v} h`;
    default:
      return fmtNumber(v);
  }
}

/** Axis tick formatter for $ charts. */
export const tickM = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v / 1_000_000).toFixed(Math.abs(v) < 10_000_000 && v !== 0 ? 1 : 0)}M`;
