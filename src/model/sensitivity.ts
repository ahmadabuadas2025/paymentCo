// Sensitivity analysis: a ±20% tornado and a Monte Carlo simulation of portfolio NPV.

import { computePortfolio } from './portfolio';
import { getUseCase } from './useCases';
import type { DriverDef, ScenarioState, UseCaseDef, UseCaseId } from './types';

/** Change one driver and return a new state (shares are capped at 100%). */
function withDriver(state: ScenarioState, id: UseCaseId, driver: DriverDef, value: number): ScenarioState {
  const v = driver.isShare ? Math.min(1, value) : value;
  return { ...state, drivers: { ...state.drivers, [id]: { ...state.drivers[id], [driver.id]: v } } };
}

export interface TornadoBar {
  key: string; // e.g. "disputes.D1"
  label: string;
  useCase: UseCaseId;
  low: number; // portfolio NPV with the driver at -swing
  high: number; // portfolio NPV with the driver at +swing
  base: number;
  range: number; // |high - low|
}

/** Flex every funded driver ±swing and return the `top` drivers that move portfolio NPV most. */
export function tornado(state: ScenarioState, swing = 0.2, top = 10): TornadoBar[] {
  const base = computePortfolio(state).totals.npv;
  const bars: TornadoBar[] = [];
  for (const id of Object.keys(state.funded) as UseCaseId[]) {
    if (!state.funded[id]) continue;
    const u = getUseCase(id);
    for (const d of u.drivers) {
      const v = state.drivers[id][d.id];
      if (!v) continue; // a zero driver cannot move by a percentage
      const low = computePortfolio(withDriver(state, id, d, v * (1 - swing))).totals.npv;
      const high = computePortfolio(withDriver(state, id, d, v * (1 + swing))).totals.npv;
      bars.push({ key: `${id}.${d.id}`, label: `${u.short}: ${d.label}`, useCase: id, low, high, base, range: Math.abs(high - low) });
    }
  }
  return bars.sort((a, b) => b.range - a.range).slice(0, top);
}

// ---- Monte Carlo ----

/** Small, fast, seeded PRNG (mulberry32) so runs are repeatable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw from a triangular distribution (min a, mode c, max b). */
export function triangular(u: number, a: number, c: number, b: number): number {
  if (b <= a) return c;
  const fc = (c - a) / (b - a);
  return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

/**
 * Multiplier range for a driver, from the use case's downside/upside bounds.
 * Value drivers move with the benefit bounds (e.g. 0.6x .. 1.3x);
 * cost drivers move with the investment bounds (e.g. 0.9x .. 1.25x).
 */
export function driverRange(u: UseCaseDef, d: DriverDef): [number, number, number] {
  return d.direction === 1
    ? [1 + u.downside.benefit, 1, 1 + u.upside.benefit]
    : [1 + u.upside.invest, 1, 1 + u.downside.invest];
}

export interface MonteCarloResult {
  draws: number[]; // portfolio NPV per draw, in draw order (used to animate the histogram)
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  probNegative: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Run `n` draws. Every driver of every funded use case gets its own triangular multiplier. */
export function monteCarlo(state: ScenarioState, n = 2000, seed = 2030): MonteCarloResult {
  const rand = mulberry32(seed);
  const fundedIds = (Object.keys(state.funded) as UseCaseId[]).filter((id) => state.funded[id]);
  const draws: number[] = [];
  for (let i = 0; i < n; i++) {
    const drivers = { ...state.drivers };
    for (const id of fundedIds) {
      const u = getUseCase(id);
      const row: Record<string, number> = {};
      for (const d of u.drivers) {
        const [a, c, b] = driverRange(u, d);
        let v = state.drivers[id][d.id] * triangular(rand(), a, c, b);
        if (d.isShare) v = Math.min(1, v);
        row[d.id] = v;
      }
      drivers[id] = row;
    }
    draws.push(computePortfolio({ ...state, drivers }).totals.npv);
  }
  const sorted = [...draws].sort((a, b) => a - b);
  return {
    draws,
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    mean: draws.reduce((a, b) => a + b, 0) / Math.max(1, n),
    probNegative: draws.filter((x) => x < 0).length / Math.max(1, n),
  };
}

/** Count values into `bins` equal-width bins between min and max. */
export function histogram(values: number[], min: number, max: number, bins = 40): { x0: number; x1: number; count: number }[] {
  const width = (max - min) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: min + i * width, x1: min + (i + 1) * width, count: 0 }));
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    out[i].count++;
  }
  return out;
}
