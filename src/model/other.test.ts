import { describe, expect, it } from 'vitest';
import { BUDGET_TOTAL, defaultBudget, summarizeBudget } from './budget';
import { scorecardRows } from './scorecard';
import { defaultScenario } from './portfolio';
import { histogram, monteCarlo, tornado, triangular } from './sensitivity';
import { DEFAULT_PILOT, simulatePilot } from './pilot';

describe('budget', () => {
  it('defaults sum to $15.0M with a 26% people-and-controls share', () => {
    const s = summarizeBudget(defaultBudget());
    expect(s.yearTotals).toEqual([7_300_000, 4_400_000, 3_300_000]);
    expect(s.total).toBe(BUDGET_TOTAL);
    expect(s.balanced).toBe(true);
    expect(s.peopleShare).toBeCloseTo(0.26, 6);
    expect(s.techHeavy).toBe(false);
  });
  it('flags a tech-heavy budget', () => {
    const b = defaultBudget();
    b[4] = [0, 0, 0];
    b[5] = [0, 0, 0];
    b[6] = [0, 0, 0];
    expect(summarizeBudget(b).techHeavy).toBe(true);
  });
});

describe('scorecard', () => {
  it('averages match the workbook', () => {
    const avgs = Object.fromEntries(scorecardRows().map((r) => [r.id, r.average]));
    expect(avgs).toEqual({ fraud: 4, disputes: 3.75, fincrime: 3.625, contact: 3.25, product: 3.125, growth: 3.125, finintel: 2.75 });
  });
});

describe('sensitivity', () => {
  it('triangular stays in range and hits the mode', () => {
    expect(triangular(0, 0.6, 1, 1.3)).toBeCloseTo(0.6);
    expect(triangular(1, 0.6, 1, 1.3)).toBeCloseTo(1.3);
    expect(triangular(0.4 / 0.7, 0.6, 1, 1.3)).toBeCloseTo(1);
  });
  it('tornado returns 10 bars sorted by impact', () => {
    const t = tornado(defaultScenario());
    expect(t).toHaveLength(10);
    for (let i = 1; i < t.length; i++) expect(t[i - 1].range).toBeGreaterThanOrEqual(t[i].range);
    expect(t[0].key).toBe('fraud.LA'); // the $4.5M fraud loss line dominates
  });
  it('Monte Carlo is repeatable and ordered', () => {
    const a = monteCarlo(defaultScenario(), 500, 7);
    const b = monteCarlo(defaultScenario(), 500, 7);
    expect(a.draws).toEqual(b.draws);
    expect(a.p10).toBeLessThan(a.p50);
    expect(a.p50).toBeLessThan(a.p90);
    expect(a.probNegative).toBeGreaterThanOrEqual(0);
    const bins = histogram(a.draws, Math.min(...a.draws), Math.max(...a.draws), 20);
    expect(bins.reduce((s, x) => s + x.count, 0)).toBe(500);
  });
});

describe('pilot simulator', () => {
  it('default pilot passes all three gates without a stop', () => {
    const run = simulatePilot(DEFAULT_PILOT);
    expect(run.stop).toBeNull();
    expect(run.gates.map((g) => g.pass)).toEqual([true, true, true]);
    expect(run.days[0].cycleTime).toBeGreaterThan(4);
  });
  it('too few analysts misses Reg E deadlines', () => {
    const run = simulatePilot({ ...DEFAULT_PILOT, analysts: 5 });
    expect(run.stop?.reason).toBe('reg-e-miss');
  });
  it('rubber-stamping (override under 2%) triggers a stop', () => {
    const run = simulatePilot({ ...DEFAULT_PILOT, overrideRate: 0.01 });
    expect(run.stop?.reason).toBe('override-out-of-band');
  });
  it('heavy overriding triggers a stop', () => {
    const run = simulatePilot({ ...DEFAULT_PILOT, overrideRate: 0.4 });
    expect(run.stop?.reason).toBe('override-out-of-band');
  });
});
