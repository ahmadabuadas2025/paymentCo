// Portfolio engine: turns a ScenarioState into per-use-case and portfolio results.
//
// Order of operations for each use case:
//   1. Driver values -> value-formula lines (useCases.ts)
//   2. Approach switches (build/buy, human review, shared data layer) adjust those lines
//   3. Global levers (benefit / investment adjustment, ramp, delay, haircut delta) apply
//   4. Finance formulas (finance.ts) produce NPV, payback, risk-adjusted and scenario NPVs
//
// With every switch and lever at its default, steps 2-3 change nothing, so the base case
// reproduces the class workbook exactly (see portfolio.test.ts).

import {
  costOfDelay,
  netAnnualValue,
  paybackMonths,
  rampedFactor,
  riskAdjustedRoi,
} from './finance';
import { defaultBudget } from './budget';
import { USE_CASES, defaultDrivers } from './useCases';
import type {
  Approaches,
  Globals,
  PortfolioResult,
  ScenarioState,
  UseCaseDef,
  UseCaseId,
  UseCaseResult,
  ValueComponents,
} from './types';

// ---- Approach switch effects (documented on the Approaches screen and in the README) ----
export const APPROACH_EFFECTS = {
  /** Buying a vendor solution: lower Year-0, higher run cost, faster Year-1 ramp. */
  buy: { year0Mult: 0.7, opexMult: 1.25, rampBoost: 0.2 },
  /** Human-review level: lower review effort saves operating cost but raises residual risk. */
  review: {
    all: { opexMult: 1.0, riskMult: 1.0 },
    sampled: { opexMult: 0.9, riskMult: 1.4 },
    auto: { opexMult: 0.8, riskMult: 2.0 },
  },
  /** Shared data layer: later use cases need 15% less integration + data work. */
  sharedDataDiscount: 0.15,
} as const;

export const DEFAULT_GLOBALS: Globals = {
  discountRate: 0.1,
  haircutDelta: 0,
  benefitAdj: 0,
  investAdj: 0,
  adoptionRamp: 1,
  delayMonths: 0,
};

function mapIds<T>(fn: (u: UseCaseDef) => T): Record<UseCaseId, T> {
  return Object.fromEntries(USE_CASES.map((u) => [u.id, fn(u)])) as Record<UseCaseId, T>;
}

export function defaultApproaches(): Approaches {
  return {
    sourcing: mapIds(() => 'build'),
    pilotFirst: 'disputes',
    humanReview: 'all',
    sharedDataLayer: false,
  };
}

/** The team's base case: "Protect the Network First". */
export function defaultScenario(name = 'Base'): ScenarioState {
  return {
    name,
    drivers: mapIds((u) => defaultDrivers(u)),
    funded: mapIds((u) => u.defaultFunded),
    globals: { ...DEFAULT_GLOBALS },
    approaches: defaultApproaches(),
    budget: defaultBudget(),
  };
}

/**
 * Rollout order: the pilot-first use case, then the other of Fraud/Disputes, then the rest.
 * The first use case leads; every later one lags it.
 */
export function rolloutOrder(a: Approaches): UseCaseId[] {
  const second = a.pilotFirst === 'disputes' ? 'fraud' : 'disputes';
  return [a.pilotFirst, second, ...USE_CASES.map((u) => u.id).filter((id) => id !== 'fraud' && id !== 'disputes')];
}

/** Apply build/buy, human-review and shared-data-layer switches to the value lines. */
export function applyApproaches(
  id: UseCaseId,
  c: ValueComponents,
  a: Approaches,
): ValueComponents {
  const out = { ...c };
  if (a.sourcing[id] === 'buy') {
    out.year0 *= APPROACH_EFFECTS.buy.year0Mult;
    out.year0Integration *= APPROACH_EFFECTS.buy.year0Mult;
    out.operatingCost *= APPROACH_EFFECTS.buy.opexMult;
  }
  const review = APPROACH_EFFECTS.review[a.humanReview];
  out.operatingCost *= review.opexMult;
  out.residualRisk *= review.riskMult;
  if (a.sharedDataLayer && rolloutOrder(a)[0] !== id) {
    const saving = out.year0Integration * APPROACH_EFFECTS.sharedDataDiscount;
    out.year0 -= saving;
    out.year0Integration -= saving;
  }
  return out;
}

/**
 * Share of full annual value reached in Years 1..3.
 * Year 1 = adoption ramp (lagging use cases reach ramp², buy adds +20 pts), minus months of delay / 12.
 * With the default ramp of 100% and no delay, every year is 100%.
 */
export function yearShares(id: UseCaseId, g: Globals, a: Approaches): number[] {
  const leads = rolloutOrder(a)[0] === id;
  let y1 = leads ? g.adoptionRamp : g.adoptionRamp * g.adoptionRamp;
  if (a.sourcing[id] === 'buy') y1 += APPROACH_EFFECTS.buy.rampBoost;
  y1 = Math.min(1, y1) - g.delayMonths / 12;
  return [Math.max(0, Math.min(1, y1)), 1, 1];
}

/** Compute one use case from raw driver values. */
export function computeUseCase(
  u: UseCaseDef,
  drivers: Record<string, number>,
  state: Pick<ScenarioState, 'globals' | 'approaches' | 'funded'>,
): UseCaseResult {
  const { globals: g, approaches: a } = state;
  const components = applyApproaches(u.id, u.compute(drivers, g.discountRate), a);
  const net = netAnnualValue(components) * (1 + g.benefitAdj);
  const year0 = components.year0 * (1 + g.investAdj);
  const shares = yearShares(u.id, g, a);
  const factor = rampedFactor(g.discountRate, shares);
  const haircut = Math.min(0.95, Math.max(0, u.haircut + g.haircutDelta));
  const riskAdjNpv = net * (1 - haircut) * factor - year0;
  return {
    id: u.id,
    funded: state.funded[u.id],
    components,
    net,
    year0,
    yearShares: shares,
    npv: net * factor - year0,
    payback: paybackMonths(year0, net),
    haircut,
    riskAdjNpv,
    riskAdjRoi: riskAdjustedRoi(riskAdjNpv, year0),
    downsideNpv: net * (1 + u.downside.benefit) * factor - year0 * (1 + u.downside.invest),
    upsideNpv: net * (1 + u.upside.benefit) * factor - year0 * (1 + u.upside.invest),
    costOfDelayQuarter: costOfDelay(net, 3),
  };
}

const ZERO_COMPONENTS: ValueComponents = {
  costSavings: 0,
  lossAvoidance: 0,
  revenue: 0,
  workingCapital: 0,
  operatingCost: 0,
  residualRisk: 0,
  year0: 0,
  year0Integration: 0,
};

/** Compute every use case and the portfolio totals (sum across funded use cases). */
export function computePortfolio(state: ScenarioState): PortfolioResult {
  const useCases = USE_CASES.map((u) => computeUseCase(u, state.drivers[u.id], state));
  const funded = useCases.filter((r) => r.funded);
  const sum = (f: (r: UseCaseResult) => number) => funded.reduce((s, r) => s + f(r), 0);

  const net = sum((r) => r.net);
  const year0 = sum((r) => r.year0);
  const riskAdjNpv = sum((r) => r.riskAdjNpv);
  const components = { ...ZERO_COMPONENTS };
  for (const r of funded) {
    for (const k of Object.keys(components) as (keyof ValueComponents)[]) components[k] += r.components[k];
  }
  // Show the global benefit adjustment as its own effect on the portfolio waterfall lines.
  const adj = 1 + state.globals.benefitAdj;
  for (const k of ['costSavings', 'lossAvoidance', 'revenue', 'workingCapital', 'operatingCost', 'residualRisk'] as const) {
    components[k] *= adj;
  }
  components.year0 = year0;

  return {
    useCases,
    funded,
    totals: {
      net,
      year0,
      npv: sum((r) => r.npv),
      payback: paybackMonths(year0, net),
      riskAdjNpv,
      riskAdjRoi: riskAdjustedRoi(riskAdjNpv, year0),
      downsideNpv: sum((r) => r.downsideNpv),
      upsideNpv: sum((r) => r.upsideNpv),
      costOfDelayQuarter: costOfDelay(net, 3),
      components,
    },
  };
}
