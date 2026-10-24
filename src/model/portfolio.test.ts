// Acceptance tests: the base case must reproduce the class workbook's numbers.
import { describe, expect, it } from 'vitest';
import { annuityFactor, costOfDelay, npv, paybackMonths, scenarioNpv } from './finance';
import { computePortfolio, defaultScenario } from './portfolio';
import type { UseCaseId } from './types';

const M = 1_000_000;
const base = computePortfolio(defaultScenario());
const uc = (id: UseCaseId) => base.useCases.find((r) => r.id === id)!;

// Values from the acceptance table in the brief ($M, rounded to 2 dp; payback to 1 dp).
const table = [
  { id: 'fraud' as const, net: 4.9, npv: 9.19, payback: 7.3, down: 3.71, up: 13.14 },
  { id: 'disputes' as const, net: 3.79, npv: 6.93, payback: 7.9, down: 2.53, up: 10.01 },
  { id: 'fincrime' as const, net: 1.17, npv: 1.1, payback: 18.5, down: -0.51, up: 2.16 },
];

describe('finance formulas', () => {
  it('3-year annuity factor at 10%', () => {
    expect(annuityFactor(0.1)).toBeCloseTo(2.486852, 6);
  });
  it('NPV, payback, scenario NPV and cost of delay', () => {
    expect(npv(4.9 * M, 3 * M, 0.1)).toBeCloseTo(9_185_574.76, 1);
    expect(paybackMonths(3 * M, 4.9 * M)).toBeCloseTo(7.3469, 3);
    expect(paybackMonths(1, 0)).toBe(Infinity);
    expect(scenarioNpv(4.9 * M, 3 * M, 0.1, -0.4, 0.2)).toBeCloseTo(3_711_344.85, 1);
    expect(costOfDelay(1.2 * M, 3)).toBe(300_000);
  });
});

describe('acceptance table: base case', () => {
  for (const row of table) {
    it(`${row.id} matches the workbook`, () => {
      const r = uc(row.id);
      expect(r.net / M).toBeCloseTo(row.net, 2);
      expect(r.npv / M).toBeCloseTo(row.npv, 2);
      expect(r.payback).toBeCloseTo(row.payback, 1);
      expect(r.downsideNpv / M).toBeCloseTo(row.down, 2);
      expect(r.upsideNpv / M).toBeCloseTo(row.up, 2);
    });
  }

  it('portfolio totals', () => {
    const t = base.totals;
    expect(base.funded.map((r) => r.id)).toEqual(['fraud', 'disputes', 'fincrime']);
    expect(t.net / M).toBeCloseTo(9.86, 2);
    expect(t.npv / M).toBeCloseTo(17.22, 2);
    expect(t.payback).toBeCloseTo(8.9, 1);
    expect(t.downsideNpv / M).toBeCloseTo(5.74, 2);
    expect(t.upsideNpv / M).toBeCloseTo(25.31, 2);
    expect(t.riskAdjNpv / M).toBeCloseTo(12.17, 2);
    expect(t.riskAdjRoi).toBeCloseTo(1.67, 2);
    expect(t.year0).toBe(7_300_000);
  });

  it('driver-level lines match the workbook roll-ups', () => {
    const d = uc('disputes').components;
    expect(d.costSavings).toBeCloseTo(3_720_000, 6);
    expect(d.lossAvoidance).toBeCloseTo(950_400, 6);
    expect(d.revenue).toBe(500_000);
    expect(d.workingCapital).toBeCloseTo(162_739.726, 2);
    expect(d.operatingCost).toBeCloseTo(1_185_000, 6);
    expect(d.residualRisk).toBeCloseTo(355_000, 6);
    expect(d.year0).toBe(2_500_000);
    const f = uc('fincrime').components;
    expect(f.costSavings).toBeCloseTo(2_238_000, 6);
    expect(f.lossAvoidance).toBeCloseTo(200_000, 6);
    expect(f.operatingCost).toBe(970_000);
    expect(f.residualRisk).toBeCloseTo(300_000, 6);
    expect(f.year0).toBe(1_800_000);
  });
});

describe('levers and approaches', () => {
  it('a slower adoption ramp lowers NPV but not payback', () => {
    const s = defaultScenario();
    s.globals.adoptionRamp = 0.5;
    const r = computePortfolio(s);
    expect(r.totals.npv).toBeLessThan(base.totals.npv);
    expect(r.totals.payback).toBeCloseTo(base.totals.payback, 6);
  });

  it('buy lowers Year-0 and raises operating cost', () => {
    const s = defaultScenario();
    s.approaches.sourcing.disputes = 'buy';
    const r = computePortfolio(s).useCases.find((x) => x.id === 'disputes')!;
    expect(r.year0).toBeCloseTo(1_750_000, 6);
    expect(r.components.operatingCost).toBeCloseTo(1_185_000 * 1.25, 6);
  });

  it('shared data layer discounts integration for later use cases only', () => {
    const s = defaultScenario();
    s.approaches.sharedDataLayer = true;
    const r = computePortfolio(s);
    expect(r.useCases.find((x) => x.id === 'disputes')!.year0).toBe(2_500_000); // pilot first
    expect(r.useCases.find((x) => x.id === 'fincrime')!.year0).toBeCloseTo(1_800_000 - 0.15 * 1_000_000, 6);
    expect(r.useCases.find((x) => x.id === 'fraud')!.year0).toBeCloseTo(3_000_000 - 0.15 * 1_500_000, 6);
  });

  it('lighter human review cuts opex and raises residual risk', () => {
    const s = defaultScenario();
    s.approaches.humanReview = 'auto';
    const r = computePortfolio(s).useCases.find((x) => x.id === 'fincrime')!;
    expect(r.components.operatingCost).toBeCloseTo(970_000 * 0.8, 6);
    expect(r.components.residualRisk).toBeCloseTo(600_000, 6);
  });

  it('swapping Fin Crime for Contact Center changes the funded set', () => {
    const s = defaultScenario();
    s.funded.fincrime = false;
    s.funded.contact = true;
    const r = computePortfolio(s);
    expect(r.funded.map((x) => x.id)).toEqual(['fraud', 'disputes', 'contact']);
  });
});
